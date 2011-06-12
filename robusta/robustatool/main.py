import hashlib
import os
import random
import sys

import robusta.ui.app

def action_create(name, args):
    """create a new app instance"""

    from optparse import OptionParser, OptionGroup
    parser = OptionParser("%%prog %s [options] <path>" % name)

    group = OptionGroup(parser, "CONFIG OPTIONS")
    group.add_option("", "--debug-server", dest="debug_server",
                      help="run server in debug mode [%default]",
                     action="store_true", default=False)
    parser.add_option_group(group)

    (opts, args) = parser.parse_args(args)

    if len(args) != 1:
        parser.error("invalid number of arguments")

    install_path, = args
    install_path = os.path.abspath(install_path)
    cfg_path = os.path.join(install_path, "app.cfg")
    app_path = os.path.join(install_path, "app.wsgi")

    # Create the install directory.
    if os.path.exists(install_path):
        parser.error("refusing to install: %r exists" % install_path)
    try:
        os.mkdir(install_path)
    except:
        parser.error("unable to create directory: %r" % install_path)

    # Construct the config file.
    sample_cfg_path = os.path.join(os.path.abspath(os.path.dirname(__file__)),
                                   "app.cfg.sample")
    sample_cfg_file = open(sample_cfg_path, "rb")
    sample_cfg_data = sample_cfg_file.read()
    sample_cfg_file.close()

    # Fill in the sample config.
    secret_key = hashlib.sha1(str(random.getrandbits(256))).hexdigest()
    cfg_options = dict(opts.__dict__)
    cfg_options['secret_key'] = secret_key
    cfg_data = sample_cfg_data % cfg_options

    # Write the initial config file.
    cfg_file = open(cfg_path, 'w')
    cfg_file.write(cfg_data)
    cfg_file.close()

    # Construct the WSGI app file.
    app_wsgi_path = os.path.join(os.path.abspath(os.path.dirname(__file__)),
                                   "app.wsgi.sample")
    app_wsgi_file = open(app_wsgi_path, "rb")
    app_wsgi_data = app_wsgi_file.read()
    app_wsgi_file.close()

    # Fill in the sample WSGI app.
    virtual_env = os.environ.get('VIRTUAL_ENV')
    if virtual_env:
        site_import_string = """
import site
site.addsitedir(%r)\n""" % virtual_env
    else:
        site_import_string = ""

    app_data = app_wsgi_data % { 'site_import_string' : site_import_string,
                                 'app_config_path' : cfg_path }
    app_file = open(app_path, 'w')
    app_file.write(app_data)
    app_file.close()

    # Validate that we can instantiate this instance.
    instance = robusta.ui.app.App.create_standalone(
        config_path = cfg_path)

def action_runserver(name, args):
    """run an app instance"""

    from optparse import OptionParser, OptionGroup
    parser = OptionParser("%%prog %s [options] [config]" % name)
    (opts, args) = parser.parse_args(args)

    if len(args) == 0:
        config_path = None
    elif len(args) == 1:
        config_path, = args
        config_path = os.path.abspath(config_path)
    else:
        parser.error("invalid number of arguments")

    instance = robusta.ui.app.App.create_standalone(
        config_path = config_path)
    instance.run()
    
###

commands = dict((name[7:].replace("_","-"), f)
                for name,f in locals().items()
                if name.startswith('action_'))

def usage():
    print >>sys.stderr, "Usage: %s command [options]" % (
        os.path.basename(sys.argv[0]))
    print >>sys.stderr
    print >>sys.stderr, "Available commands:"
    cmds_width = max(map(len, commands))
    for name,func in sorted(commands.items()):
        print >>sys.stderr, "  %-*s - %s" % (cmds_width, name, func.__doc__)
    sys.exit(1)

def main():
    import sys

    if len(sys.argv) < 2 or sys.argv[1] not in commands:
        usage()

    cmd = sys.argv[1]
    commands[cmd](cmd, sys.argv[2:])

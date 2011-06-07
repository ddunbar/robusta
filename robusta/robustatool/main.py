import os
import sys

import robusta.ui.app

def action_runserver(name, args):
    """run an app instance"""

    from optparse import OptionParser, OptionGroup
    parser = OptionParser("%%prog %s [options]" % name)
    (opts, args) = parser.parse_args(args)

    if len(args) != 0:
        parser.error("invalid number of arguments")

    instance = robusta.ui.app.App.create_standalone()
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

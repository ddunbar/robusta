import robusta
import os

from setuptools import setup, find_packages

# setuptools expects to be invoked from within the directory of setup.py, but it
# is nice to allow:
#   python path/to/setup.py install
# to work (for scripts, etc.)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

setup(
    name = "robusta",
    version = robusta.__version__,

    author = robusta.__author__,
    author_email = robusta.__email__,
    url = 'http://minormatter.com/robusta',
    license = 'BSD',

    description = "Robusta -- Taste Testing",

    # Additional resource extensions we use.
    package_data = { 'robusta.ui' : ['static/*.ico',
                                     'static/*.css',
                                     'static/*.js',
                                     'static/*.pdf',
                                     'static/jquery/1.5/*.js',
                                     'templates/*.html' ] },

    zip_safe = False,
    packages = find_packages(),
    entry_points = {
        'console_scripts': [
            'robusta = robusta.robustatool:main',
            ],
        },
    install_requires=['Flask', 'pymongo', 'simplejson'],
)

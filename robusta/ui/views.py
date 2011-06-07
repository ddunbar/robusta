import flask
from flask import render_template

###
# Top-level Information

frontend = flask.Module(__name__)

@frontend.route('/')
def index():
    return render_template("index.html")

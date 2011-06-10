import flask
from flask import current_app
from flask import redirect
from flask import render_template
from flask import request
from flask import session
from flask import url_for

###
# Top-level Information

frontend = flask.Module(__name__)

@frontend.route('/')
def index():
    return render_template("index.html")

@frontend.route('/favicon.ico')
def favicon():
    return redirect(url_for(".static", filename='favicon.ico'))

###
# Session Management

@frontend.route('/login', methods=['POST'])
def login():
    # Log the user in.
    username = request.form['username']
    session['active_user'] = username
    return redirect(url_for("index"))

@frontend.route('/logout')
def logout():
    session.pop('active_user', None)
    return redirect(url_for("index"))

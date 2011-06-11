import binascii
import pymongo.objectid

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

###
# Tasting's APIs

@frontend.route('/tastings')
def tastings():
    # Get the tastings collection.
    tastings = current_app.db.tastings
    
    # Return the limited tastings information.
    result = []
    for tasting in tastings.find():
        result.append({ "id" : binascii.hexlify(tasting['_id'].binary),
                        "name" : tasting['name'] })

    return flask.jsonify(tastings = result)

@frontend.route('/add_tasting')
def add_tasting():
    # Create a new tasting object.
    tasting = { "name" : "New Tasting",
                "variables" : [],
                "metrics" : [] }

    # Get the tastings collection.
    tastings = current_app.db.tastings
    res = tastings.insert(tasting);

    # Return the tasting ID.
    return flask.jsonify(new_tasting_id = binascii.hexlify(
            tasting['_id'].binary))

@frontend.route('/tasting/<id>/delete')
def delete_tasting(id):
    # Validate the ID.
    binary = binascii.unhexlify(id)
    
    current_app.db.tastings.remove(pymongo.objectid.ObjectId(binary))

    return flask.jsonify(result = 'OK')

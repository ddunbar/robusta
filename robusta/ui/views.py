import binascii
import json
import pymongo.objectid

import flask
from flask import abort
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
    return render_template("index.html",
                           user_data = current_app.get_user_data())

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

# Decorator for admin users.
def admin_route(rule, **options):
    def decorator(f):
        def wrap(**args):
            # Validate the user has admin access.
            if not current_app.is_user_admin():
                return abort(403)

            return f(**args)

        frontend.add_url_rule(rule, f.__name__, wrap, **options)
        return wrap
    return decorator

@admin_route('/tastings')
def tastings():
    # Get the tastings collection.
    tastings = current_app.db.tastings
    
    # Return the limited tastings information.
    result = []
    for tasting in tastings.find():
        item = tasting.copy()
        item["id"] = binascii.hexlify(item.pop('_id').binary)
        result.append(item)

    return flask.jsonify(tastings = result)

@admin_route('/add_tasting')
def add_tasting():
    # Create a new tasting object.
    tasting = { "name" : "New Tasting",
                "variables" : [],
                "metrics" : [],
                "active" : False }

    # Get the tastings collection.
    tastings = current_app.db.tastings
    res = tastings.insert(tasting);

    # Return the tasting ID.
    return flask.jsonify(new_tasting_id = binascii.hexlify(
            tasting['_id'].binary))

@admin_route('/tasting/<id>/delete')
def delete_tasting(id):
    # Validate the ID.
    oid = pymongo.objectid.ObjectId(binascii.unhexlify(id))
    
    current_app.db.tastings.remove(oid)

    return flask.jsonify(result = 'OK')

@admin_route('/tasting/<id>/activate')
def activate_tasting(id):
    # Validate the ID.
    oid = pymongo.objectid.ObjectId(binascii.unhexlify(id))

    current_app.db.tastings.update({}, { "$set" : {
                "active" : False} })
    current_app.db.tastings.update({ "_id" : oid }, { "$set" : {
                "active" : True} })

    return flask.jsonify(result = 'OK')

@admin_route('/tasting/<id>/deactivate')
def deactivate_tasting(id):
    # Validate the ID.
    oid = pymongo.objectid.ObjectId(binascii.unhexlify(id))

    current_app.db.tastings.update({ "_id" : oid }, { "$set" : {
                "active" : False} })

    return flask.jsonify(result = 'OK')

@admin_route('/tasting/<id>/save')
def save_tasting(id):
    # Validate the ID.
    oid = pymongo.objectid.ObjectId(binascii.unhexlify(id))

    # Get the current object.
    current = current_app.db.tastings.find_one({ '_id' : oid })

    # Get the new JSON object.
    tasting = json.loads(request.args.get('tasting'))
    if tasting.pop('id', None) != binascii.hexlify(current['_id'].binary):
        abort(400)

    # Set the appropriate id.
    tasting['_id'] = oid

    # Reject attempts to change the keys.
    if set(tasting) != set(current):
        abort(400)

    # Update the database entry.
    current_app.db.tastings.remove(oid)
    current_app.db.tastings.insert(tasting)

    return flask.jsonify(result = 'OK')

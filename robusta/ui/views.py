import binascii
import pymongo.objectid
import random

import flask
from flask import abort
from flask import current_app
from flask import redirect
from flask import render_template
from flask import request
from flask import session
from flask import url_for
from flask import json

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

def add_previous_user(user):
    previous_users = session.get('previous_users', [])[:5]
    if user not in previous_users:
        session['previous_users'] = [user] + previous_users

@frontend.route('/login', methods=['POST'])
def login():
    # Log the user in.
    username = request.form['username']
    session['active_user'] = username
    add_previous_user(username)
    return redirect(url_for("index"))

@frontend.route('/logout')
def logout():
    user = session.pop('active_user', None)
    if user:
        add_previous_user(user)
    return redirect(url_for("index"))

@frontend.route('/save_user_pref')
def save_user_pref():
    preference = request.args.get('preference')
    value = request.args.get('value')

    if preference not in ('active_menu_item',
                          'active_tastings_item'):
        return abort(403)

    user = flask.session.get('active_user', None)
    if not user:
        return abort(500)

    current_app.db.users.update({ '_id' : user },
                                { '$set' : { preference : value } },
                                upsert = True)

    return flask.jsonify(result = 'OK')

###
# General APIs

@frontend.route('/current_tasting')
def current_tasting():
    item = current_app.get_active_tasting()
    item["id"] = binascii.hexlify(item.pop('_id').binary)
    return flask.jsonify(tasting = item)

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
                "technicians" : [],
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
                "active" : False} }, multi=True)
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

    # Update the database entry.
    current_app.db.tastings.remove(oid)
    current_app.db.tastings.insert(tasting)

    return flask.jsonify(result = 'OK')

###
# Technician APIs

# Decorator for technician users.
def technician_route(rule, **options):
    def decorator(f):
        def wrap(**args):
            # Validate the user has technician access.
            if not current_app.is_user_technician():
                return abort(403)

            return f(**args)

        frontend.add_url_rule(rule, f.__name__, wrap, **options)
        return wrap
    return decorator

@technician_route('/tasting/<id>/products')
def tasting_products(id):
    # Validate the ID.
    oid = pymongo.objectid.ObjectId(binascii.unhexlify(id))

    products = []
    for item in current_app.db.products.find({ 'tasting' : oid }):
        products.append({ 'name' : item['name'],
                          'description' : item['description'] })

    return flask.jsonify(products = products)

@technician_route('/tasting/<id>/add_product')
def add_product(id):
    # Validate the ID.
    oid = pymongo.objectid.ObjectId(binascii.unhexlify(id))

    name = request.args.get('name')
    description = request.args.get('description')
    recipient = request.args.get('recipient')
    note = request.args.get('note')

    # Assign a label ID to this product.
    current_ids = set(
        item['label']
        for item in current_app.db.products.find({ 'tasting' : oid },
                                                 { 'label' : True }))
    labels = list(set(range(100)) - current_ids)
    label = random.choice(labels)

    result = current_app.db.products.insert({ 'tasting' : oid,
                                              'name' : name,
                                              'description' : description,
                                              'label' : label })

    # Create a recipient ticket.
    ticket = current_app.db.tickets.insert({ 'product' : result,
                                             'recipient' : recipient,
                                             'note' : note })

    return flask.jsonify(result = 'OK')

@technician_route('/tickets')
def tickets():
    user = flask.session.get('active_user', None)
    if not user:
        return abort(500)

    tickets = []
    for item in current_app.db.tickets.find({ 'recipient' : user }):
        product = current_app.db.products.find_one(item['product'])
        tickets.append({ 'id' : binascii.hexlify(item['_id'].binary),
                         'label' : product['label'],
                         'note' : item['note'] })

    return flask.jsonify(tickets = tickets)

@technician_route('/ticket/<id>/claim')
def claim_ticket(id):
    # Validate the ID.
    oid = pymongo.objectid.ObjectId(binascii.unhexlify(id))

    current_app.db.tickets.remove(oid)

    return flask.jsonify(result = 'OK')

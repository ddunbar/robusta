import pymongo
import flask

import robusta.ui.views

class App(flask.Flask):
    @staticmethod
    def create_standalone(config_path = None):
        # Construct the application.
        app = App(__name__)

        # Load the application configuration.
        app.load_config(config_path)

        # Load the application routes.
        app.register_module(robusta.ui.views.frontend)

        return app

    def __init__(self, name):
        super(App, self).__init__(name)
        self.connection = pymongo.Connection()
        self.db = self.connection['robusta_db']
        
    def load_config(self, config_path):
        if config_path is not None:
            self.config.from_pyfile(config_path)
        else:
            self.config.from_envvar("ROBUSTA_CONFIG")

        # Set the application secret key.
        self.secret_key = self.config["SECRET_KEY"]

        # Set the debug mode.
        self.debug = self.config["DEBUG"]

    def get_user_data(self):
        user = flask.session.get('active_user', None)
        result = self.db.users.find_one({'_id' : user })
        if result is None:
            result = {}

        # Automatically set the technician user bit based on the current
        # tasting.
        active_tasting = self.get_active_tasting()
        if active_tasting and user in active_tasting.get('technicians',[]):
            result['technician'] = True
        else:
            result['technician'] = False

        return result

    def get_active_tasting(self):
        return self.db.tastings.find_one({'active' : True })

    def is_user_admin(self):
        return bool(self.get_user_data().get('admin'))

    def is_user_technician(self):
        return bool(self.get_user_data().get('technician'))

    def get_full_rating(self, tasting, item):
        user = item['user']
        rating = item['rating']
        products = {}

        # First, expand every dependency.
        worklist = item['products'].items()
        while worklist:
            item = worklist.pop()
            name,label = item

            # Get the product for this label.
            product = self.db.products.find_one({'tasting' : tasting['_id'],
                                                 'label' : label })
            if not product:
                raise ValueError,'invalid rating'

            # Add the product label to the products map.
            products[name] = product['label']

            # Find the variable.
            for variable in tasting['variables']:
                if variable['name'] == name:
                    break
            else:
                raise ValueError,'invalid rating'

            # If this is a derived product, add it's source.
            source_index = variable.get('source_index')
            if source_index is not None:
                source = tasting['variables'][source_index]
                source_label = product['source']
                worklist.append([source['name'], source_label])

        # Verify that we have a value for each variable.
        for v in tasting['variables']:
            if v['name'] not in products:
                raise ValueError,'invalid rating'

        # Verify that we have a value for each metric.
        for m in tasting['metrics']:
            if m['name'] not in rating:
                raise ValueError,'invalid rating'

        full_rating = { 'rating' : rating,
                        'products' : products,
                        'user' : user }
        return full_rating

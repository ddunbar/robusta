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

        return result

    def get_active_tasting(self):
        return self.db.tastings.find_one({'active' : True })

    def is_user_admin(self):
        return bool(self.get_user_data().get('admin'))

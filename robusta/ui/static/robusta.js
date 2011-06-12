// Register our initialization function.
window.onload = function() { init(); }

// Global app data.
var g = {};

function init() {
    g.robusta = new Robusta('robusta_ui');
    g.robusta.init();
}

// Helper functions.

function array_remove(array, item) {
    var index = array.indexOf(item);
    if (index == -1)
        return;

    array.splice(index, 1);
}

/* Robusta Class */

function Robusta(ui_elt_name) {
    this.ui_elt_name = ui_elt_name;
    this.ui_elt = null;
    this.tasting_ui = null;
    this.status_bar = null;
}

Robusta.prototype.init = function() {
    // Locate our UI element.
    this.ui_elt = $("#" + this.ui_elt_name);

    // Add the tastings list widget, for admin users.
    if (g.user_data.admin) {
        this.tastings_ui = new TastingsWidget(this);
        this.tastings_ui.init(this.ui_elt);
    }

    // Status bar element.
    var sb = $('<div class="robusta-status-bar">Status</div>');
    sb.appendTo(this.ui_elt);
    this.status_bar = sb[0];

    this.set_status("ready!");
}

Robusta.prototype.set_status = function(label) {
    this.status_bar.innerHTML = label;
}

/* Tastings UI Element */

function TastingsWidget(robusta) {
    this.robusta = robusta;
    this.widget = null;
    this.tastings_list = null;
    this.selected_id = null;
    this.selected_item = null;
}

TastingsWidget.prototype.init = function(parent) {
    var self = this;

    this.widget = $('<div class="robusta-tastings-widget"></div>');
    this.widget.appendTo(parent);

    // Add the element to hold the tastings list.
    this.tastings_list = $('<div class="robusta-tastings-list"></div>');
    this.tastings_list.appendTo(this.widget);

    // Add a button for adding a new tasting.
    var ntb = $('<input type="button" value="New Tasting">');
    ntb.appendTo(this.widget);
    ntb.click(function () { self.add_tasting(); })

    // Add the tasting editor widget container, we instantiate a tasting editor
    // inside here on selection.
    this.tasting_editor_container = $(
        '<div robusta-tasting-editor-container></div>');
    this.tasting_editor_container.appendTo(this.widget);

    // Queue a load of the tastings.
    setTimeout(function() { self.update_tastings() }, 1);
}

TastingsWidget.prototype.add_tasting = function() {
    var self = this;

    this.robusta.set_status("adding a tasting...");
    $.getJSON("/add_tasting", {}, function (data) {
        self.robusta.set_status("added a tasting.");
        self.selected_id = data['new_tasting_id'];
        self.update_tastings();
      });
}

TastingsWidget.prototype.update_tastings = function() {
    var self = this;

    this.robusta.set_status("loading tastings...");
    $.getJSON("/tastings", {}, function (data) {
        var tastings = data['tastings'];

        // Clear the tastings list.
        self.tastings_list.empty();
        self.selected_item = null;
        self.tasting_editor_container.empty();

        // If nothing is selected (i.e., startup), select the last element.
        if (self.selected_id === null && tastings.length) {
            self.selected_id = tastings[tastings.length - 1]['id'];
        }

        // Add all the tastings.
        for (var i = 0; i != tastings.length; ++i) {
            var item = tastings[i];

            var tli = new TastingsListItem(item, self);
            tli.init(self.tastings_list);

            // Reset the selected item.
            if (item['id'] == self.selected_id)
                tli.on_select();
        }

        // Clear the selected tasting id if it was invalid.
        if (self.selected_item === null) {
            self.selected_id = null;
        }

        self.robusta.set_status("loaded tastings.");
      });
}

/* Tastings UI ListItem */

function TastingsListItem(item, list) {
    this.item = item;
    this.widget = null;
    this.list = list;
}

TastingsListItem.prototype.init = function(parent) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-tastings-list-item"></div>');
    this.widget.prependTo(parent);

    // Add the content.
    this.widget.append(this.item['name']);

    // Add event handler for selection.
    this.widget.bind('click', function() { self.on_select(); })
}

TastingsListItem.prototype.on_select = function() {
    if (this.list.selected_item !== null)
        this.list.selected_item.widget.toggleClass('selected');

    this.list.selected_id = this.item['id'];
    this.list.selected_item = this;

    this.widget.toggleClass('selected');

    // Initialize the tasting editor.
    var editor = new TastingEditorWidget(this.item, this.list);
    this.list.tasting_editor_container.empty();
    editor.init(this.list.tasting_editor_container);
}

/* Testing Editor UI Widget */

function TastingEditorWidget(item, list) {
    this.item = item;
    this.widget = null;
    this.list = list;
}

TastingEditorWidget.prototype.init = function(parent) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-tasting-editor"></div>');
    this.widget.appendTo(parent);

    // Add the name editor.
    this.widget.append("Name:");
    var name_elt = $('<input type="text" value="' + this.item['name'] + '">');
    name_elt.appendTo(this.widget);
    name_elt.change(function() { self.item['name'] = name_elt[0].value });

    // Add a button for saving this tasting.
    var b = $('<input type="button" value="Save">');
    b.appendTo(this.widget);
    b.click(function () { self.save_tasting(); })

    // Add a button for removing this tasting.
    b = $('<input type="button" value="Delete">');
    b.appendTo(this.widget);
    b.click(function () { self.delete_tasting(); })

    // Add the list of variables and a button for adding a new one.
    var variables = $("<div></div>");
    variables.append("Test Variables:");
    b = $('<input type="button" value="Add Variable">');
    b.appendTo(variables);
    b.click(function () {
        var variable = { name : "New Variable" }
        self.item['variables'].push(variable);
        new TastingVariableEditorWidget(self, variable).init(variables);
    })
    for (var i = 0; i != this.item['variables'].length; ++i) {
        var w = new TastingVariableEditorWidget(this, this.item['variables'][i]);
        w.init(variables);
    }
    variables.appendTo(this.widget);

    // Add the list of metrics and a button for adding a new one.
    var metrics = $("<div></div>");
    metrics.append("Test Metrics:");
    b = $('<input type="button" value="Add Metric">');
    b.appendTo(metrics);
    b.click(function () {
        var metric = { name : "New Metric" }
        self.item['metrics'].push(metric);
        new TastingMetricEditorWidget(self, metric).init(metrics);
    })
    for (var i = 0; i != this.item['metrics'].length; ++i) {
        var w = new TastingMetricEditorWidget(this, this.item['metrics'][i]);
        w.init(metrics);
    }
    metrics.appendTo(this.widget);
}

TastingEditorWidget.prototype.save_tasting = function() {
    var self = this;

    // Confirm with the user.
    if (!confirm('Really save tasting?'))
        return;
    
    this.list.robusta.set_status('saving tasting "' + this.item['name'] + '"...');
    var data = {'tasting' : JSON.stringify(this.item) };
    $.getJSON("/tasting/" + this.item['id'] + "/save", data, function (data) {
        self.list.update_tastings();
    });
}

TastingEditorWidget.prototype.delete_tasting = function() {
    var self = this;

    // Confirm with the user.
    if (!confirm('Really remove tasting "' + this.item['name'] + '"?'))
        return;

    this.list.robusta.set_status('remove tasting "' + this.item['name'] + '"...');
    $.getJSON("/tasting/" + this.item['id'] + "/delete", {}, function (data) {
        self.list.selected_id = null;
        self.list.update_tastings();
      });
}

/* Tasting Metric Editor UI Widget */

function TastingMetricEditorWidget(editor, item) {
    this.editor = editor;
    this.item = item;
    this.widget = null;
}

TastingMetricEditorWidget.prototype.init = function(parent) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-tasting-metric-editor"></div>');
    this.widget.appendTo(parent);

    // Add a text input for the name.
    var name_elt = $('<input type="text" value="' + this.item['name'] + '">');
    name_elt.appendTo(this.widget);
    name_elt.change(function() { self.item['name'] = name_elt[0].value });

    // Add a button for removing this metric.
    b = $('<input type="button" value="Delete">');
    b.appendTo(this.widget);
    b.click(function () {
        self.widget.remove();
        array_remove(self.editor.item['metrics'], self.item);
      })
}

/* Tasting Variable Editor UI Widget */

function TastingVariableEditorWidget(editor, item) {
    this.editor = editor;
    this.item = item;
    this.widget = null;
}

TastingVariableEditorWidget.prototype.init = function(parent) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-tasting-variable-editor"></div>');
    this.widget.appendTo(parent);

    // Add a text input for the name.
    var name_elt = $('<input type="text" value="' + this.item['name'] + '">');
    name_elt.appendTo(this.widget);
    name_elt.change(function() { self.item['name'] = name_elt[0].value });
    
    // Add a button for removing this variable.
    b = $('<input type="button" value="Delete">');
    b.appendTo(this.widget);
    b.click(function () {
        self.widget.remove();
        array_remove(self.editor.item['variables'], self.item);
      })
}

// Register our initialization function.
window.onload = function() { init(); }

// Global app data.
var g = {};

function init() {
    g.robusta = new Robusta('robusta-ui');
    g.robusta.init();
}

// Helper functions.

function array_remove(array, item) {
    var index = array.indexOf(item);
    if (index == -1)
        return;

    array.splice(index, 1);
}

function save_user_preference(key, value) {
    var current_value = g.user_data[key];
    if (current_value == value)
        return;

    g.user_data[key] = value;
    $.getJSON("save_user_pref", { 'preference' : key, 'value' : value },
              function (data) {});
}

/* Robusta Class */

function Robusta(ui_elt_name) {
    this.ui_elt_name = ui_elt_name;
    this.ui_elt = null;
    this.menu_bar = null;
    this.status_bar = null;
}

Robusta.prototype.init = function() {
    // Locate our UI element.
    this.ui_elt = $("#" + this.ui_elt_name);

    // Add the menu bar.
    this.menu_bar = new MenuBar(this);
    this.menu_bar.init($("#robusta-menu-ui"));

    // Add the testing UI.
    this.menu_bar.add_item("Testing",
                           new TestingWidget(this).init(this.ui_elt));

    // Add the tasting technician widget.
    this.menu_bar.add_item("Technician",
                           new TechnicianWidget(this).init(this.ui_elt));

    // Add the tastings list widget, for admin users.
    if (g.user_data.admin) {
        this.menu_bar.add_item("Tastings",
                               new TastingsWidget(this).init(this.ui_elt));
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

/* Menu Bar Controller */

function MenuBar(robusta) {
    this.robusta = robusta;
    this.widget = null;
    this.active = null;
    this.items = [];
    this.item_to_select = null;
}

MenuBar.prototype.init = function(parent) {
    this.widget = parent;

    // Try and select the last item automatically.
    if (g.user_data.active_menu_item != undefined)
        this.item_to_select = g.user_data.active_menu_item;

    return this;
}

MenuBar.prototype.add_item = function(name, widget) {
    var self = this;
    var item = [name, widget];
    this.items.push(item);

    var button_elt = $('<div class="robusta-menu-item"></div>');
    button_elt.appendTo(this.widget);
    button_elt.append(name);
    button_elt.click(function(event) {self.select_item(item); });
    if (!this.item_to_select && this.active === null) {
        this.select_item(item);
    } else {
        widget.widget.hide();
    }

    if (this.item_to_select && name == this.item_to_select) {
        if (this.active != item)
            this.select_item(item);
    }
}

MenuBar.prototype.select_item = function(item) {
    if (this.active)
        this.active[1].deactivate();
    this.active = item;
    this.active[1].activate();

    save_user_preference("active_menu_item", this.active[0]);
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

    // Try and select the last item automatically.
    if (g.user_data.active_tastings_item != undefined)
        this.selected_id = g.user_data.active_tastings_item;

    return this;
}

TastingsWidget.prototype.activate = function() {
    var self = this;

    this.widget.show();

    // Queue a load of the tastings.
    setTimeout(function() { self.update_tastings() }, 1);
}

TastingsWidget.prototype.deactivate = function() {
    this.widget.hide();
}

TastingsWidget.prototype.add_tasting = function() {
    var self = this;

    this.robusta.set_status("adding a tasting...");
    $.getJSON("add_tasting", {}, function (data) {
        self.robusta.set_status("added a tasting.");
        self.selected_id = data['new_tasting_id'];
        self.update_tastings();
      });
}

TastingsWidget.prototype.update_tastings = function() {
    var self = this;

    this.robusta.set_status("loading tastings...");
    $.getJSON("tastings", {}, function (data) {
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
    this.widget.click(function() { self.on_select(); })

    return this;
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

    save_user_preference("active_tastings_item", this.item['id']);
}

/* Testing Editor UI Widget */

function TastingEditorWidget(item, list) {
    this.item = item;
    this.widget = null;
    this.list = list;
    this.variable_widgets = null;

    if (this.item['technicians'] == undefined)
        this.item['technicians'] = [];
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

    // Add a button for activating/deactivating this tasting.
    if (this.item['active']) {
        b = $('<input type="button" value="Deactivate">');
        b.appendTo(this.widget);
        b.click(function () { self.deactivate_tasting(); })
    } else {
        b = $('<input type="button" value="Activate">');
        b.appendTo(this.widget);
        b.click(function () { self.activate_tasting(); })
    }

    // Add the list of variables and a button for adding a new one.
    var variables = $("<div></div>");
    variables.append("Test Variables:");
    b = $('<input type="button" value="Add Variable">');
    b.appendTo(variables);
    b.click(function () {
        var variable = { name : "New Variable" }
        self.item['variables'].push(variable);
        var w = new TastingVariableEditorWidget(self, variable);
        w.init(variables);
        self.variable_widgets.push(w);
    })
    this.variable_widgets = [];
    for (var i = 0; i != this.item['variables'].length; ++i) {
        var w = new TastingVariableEditorWidget(this, this.item['variables'][i]);
        w.init(variables);
        this.variable_widgets.push(w);
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

    // Add the list of technicians.
    var techs = $("<div></div>");
    techs.append("Test Technicians:");
    t = $('<input type="text">');
    var techs_input = t[0];
    techs_input.value = "";
    for (var i = 0; i != this.item['technicians'].length; ++i) {
        if (i)
            techs_input.value += ",";
        techs_input.value += this.item['technicians'][i];
    }
    t.change(function() {
        self.item['technicians'] = techs_input.value.split(",");
    });
    t.appendTo(techs);
    techs.appendTo(this.widget);

    return this;
}

TastingEditorWidget.prototype.save_tasting = function() {
    var self = this;

    // Confirm with the user.
    if (!confirm('Really save tasting?'))
        return;
    
    this.list.robusta.set_status('saving tasting "' + this.item['name'] + '"...');
    var data = {'tasting' : JSON.stringify(this.item) };
    $.getJSON("tasting/" + this.item['id'] + "/save", data, function (data) {
        self.list.update_tastings();
    });
}

TastingEditorWidget.prototype.delete_tasting = function() {
    var self = this;

    // Confirm with the user.
    if (!confirm('Really remove tasting "' + this.item['name'] + '"?'))
        return;

    this.list.robusta.set_status('remove tasting "' + this.item['name'] + '"...');
    $.getJSON("tasting/" + this.item['id'] + "/delete", {}, function (data) {
        self.list.selected_id = null;
        self.list.update_tastings();
      });
}

TastingEditorWidget.prototype.activate_tasting = function() {
    var self = this;

    // Confirm with the user.
    if (!confirm('Activate tasting "' + this.item['name'] + '"?'))
        return;

    this.list.robusta.set_status('activating tasting "' + this.item['name'] +
                                 '"...');
    $.getJSON("tasting/" + this.item['id'] + "/activate", {}, function (data) {
        self.list.robusta.set_status('activated tasting "' + self.item['name'] +
                                     '".');
        self.list.update_tastings();
      });
}

TastingEditorWidget.prototype.deactivate_tasting = function() {
    var self = this;

    // Confirm with the user.
    if (!confirm('Deactivate tasting "' + this.item['name'] + '"?'))
        return;

    this.list.robusta.set_status('deactivating tasting "' + this.item['name'] +
                                 '"...');
    $.getJSON("tasting/" + this.item['id'] + "/deactivate", {},
              function (data) {
        self.list.robusta.set_status('deactivated tasting "' +
                                     self.item['name'] + '".');
        self.list.update_tastings();
      });
}

TastingEditorWidget.prototype.update_sources = function() {
    for (var i = 0; i != this.variable_widgets.length; ++i) {
        this.variable_widgets[i].update_sources();
    }
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

    return this;
}

/* Tasting Variable Editor UI Widget */

function TastingVariableEditorWidget(editor, item) {
    this.editor = editor;
    this.item = item;
    this.widget = null;
    this.source_elt = null;
}

TastingVariableEditorWidget.prototype.init = function(parent) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-tasting-variable-editor"></div>');
    this.widget.appendTo(parent);

    // Add a text input for the name.
    var name_elt = $('<input type="text" value="' + this.item['name'] + '">');
    name_elt.appendTo(this.widget);
    name_elt.change(function() {
        self.item['name'] = name_elt[0].value;
        self.editor.update_sources(); });

    // Add a pulldown for selecting the source product.
    this.source_elt = $('<select></select>');
    this.widget.append("Source:");
    this.source_elt.appendTo(this.widget);
    this.update_sources();
    this.source_elt.change(function() {
        self.item['source_index'] = parseInt(self.source_elt[0].value);
    });

    // Add a button for removing this variable.
    b = $('<input type="button" value="Delete">');
    b.appendTo(this.widget);
    b.click(function () {
        self.widget.remove();

        // Remove this as the source from any products and update other source
        // indices.
        var variables = self.editor.item['variables'];
        var index =  variables.indexOf(self.item);
        for (var i = 0; i != variables.length; ++i) {
            var v = variables[i];
            if (v['source_index'] === index) {
                v['source_index'] = null;
            } else if (v['source_index'] != undefined &&
                       v['source_index'] > index) {
                v['source_index']--;
            }
        }

        array_remove(variables, self.item);

        self.editor.update_sources();
      })

    return this;
}

TastingVariableEditorWidget.prototype.update_sources = function() {
    this.source_elt.empty();
    this.source_elt.append("<option>(no source)</option>");
    for (var i = 0; i != this.editor.item['variables'].length; ++i) {
        var v = this.editor.item['variables'][i];
        if (v == this.item)
            continue;

        this.source_elt.append('<option value="' + i.toString() +'">' +
                               this.editor.item['variables'][i]['name'] +
                               '</option>');
    }

    if (this.item['source_index'] != undefined) {
        this.source_elt[0].value = this.item['source_index'];
    }
}

/* Taste Testing Technician UI */

function TechnicianWidget(robusta) {
    this.robusta = robusta;
    this.widget = null;
    this.labels = null;
    this.tasting = null;
    this.tickets = null;
    this.current_tasting_elt = null;
    this.current_tickets_elt = null;
    this.product_editors = [];
}

TechnicianWidget.prototype.init = function(parent) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-technician-editor"></div>');
    this.widget.appendTo(parent);

    this.current_tasting_elt = $("<div></div>");
    this.current_tasting_elt.appendTo(this.widget);

    this.current_tickets_elt = $("<div></div>");
    this.current_tickets_elt.appendTo(this.widget);

    return this;
}

TechnicianWidget.prototype.activate = function() {
    var self = this;

    this.widget.show();

    // Queue a load of the tasting data.
    setTimeout(function() { self.update_tasting() }, 1);

    // Queue a load of the tickets data.
    setTimeout(function() { self.update_tickets() }, 1);
}

TechnicianWidget.prototype.deactivate = function() {
    this.widget.hide();
}

TechnicianWidget.prototype.update_labels = function() {
    var self = this;

    if (!this.tasting)
        return;

    $.getJSON("tasting/" + this.tasting['id'] + '/labels', {}, function (data) {
        var labels = self.labels = data.labels;

        // Update any open product editors.
        for (var i = 0; i != self.product_editors.length; ++i)
            self.product_editors[i].update_labels();
    });
}

TechnicianWidget.prototype.update_tasting = function() {
    var self = this;

    this.robusta.set_status("loading technician data...");
    $.getJSON("current_tasting", {}, function (data) {
        var tasting = self.tasting = data['tasting'];

        self.current_tasting_elt.empty();

        if (tasting === null) {
            self.current_tasting_elt.append("<b>No Tasting In Progress</b>");
            self.robusta.set_status("no current tasting.");
            return;
        }

        self.current_tasting_elt.append("<b>Current Tasting</b><br>");
        self.current_tasting_elt.append(tasting.name);
        self.current_tasting_elt.append("<hr>");

        var elt = $("<select></select>");
        for (var i = 0; i != tasting['variables'].length; ++i) {
            var variable = tasting['variables'][i];
            elt.append('<option value="' + i.toString() +
                       '">' + variable.name + "</option>");
        }
        elt.appendTo(self.current_tasting_elt);

        var b = $('<input type="button" value="Add Product">');
        b.appendTo(self.current_tasting_elt);
        b.click(function () {
            var i = parseInt(elt[0].value);
            var variable = tasting['variables'][i];
            var w = new TechnicianProductEditorWidget(self, variable);
            w.init(self.current_tasting_elt);
            self.product_editors.push(w);
        })

        self.robusta.set_status("loaded current tasting.");

        // Queue a load of the labels data.
        setTimeout(function() { self.update_labels() }, 1);
    });
}

TechnicianWidget.prototype.update_tickets = function() {
    var self = this;

    this.robusta.set_status("loading technician tickets...");
    $.getJSON("tickets", {}, function (data) {
        var tickets = self.tickets = data['tickets'];

        self.current_tickets_elt.empty();
        self.current_tickets_elt.append("<hr>");

        for (var i = 0; i != tickets.length; ++i) {
            var ticket = tickets[i];
            var item = $('<div></div>');
            item.toggleClass("robusta-technician-product-editor");
            item.append("Ticket -- ");
            item.append("Label: " + ticket.label + ", ");
            item.append("Note: " + ticket.note);
            item.appendTo(self.current_tickets_elt);

            var b = $('<input type="button" value="Claim">');
            b.appendTo(item);
            b.click(function () {
                $.getJSON("ticket/" + ticket['id'] + "/claim", {},
                  function (data) {
                      self.robusta.set_status(
                          "ticket claimed!");
                      self.update_tickets();
                  });
                });
        }

        self.robusta.set_status("loaded tickets.");
    });
}

/* Technician Product Editor UI Widget */

function TechnicianProductEditorWidget(editor, variable) {
    this.editor = editor;
    this.variable = variable;
    this.widget = null;
    this.source = null;
    this.source_elt = null;
}

TechnicianProductEditorWidget.prototype.update_labels = function() {
    var labels = this.editor.labels[this.source['name']];
    if (!labels)
        return;

    this.source_elt.empty();
    for (var i = 0; i != labels.length; ++i) {
        this.source_elt.append('<option value="' + labels[i] + '">' +
                               labels[i] + '</option>');
    }
}

TechnicianProductEditorWidget.prototype.init = function(parent) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-technician-product-editor"></div>');
    this.widget.appendTo(parent);

    this.widget.append("<b>" + this.variable['name'] + "</b>: ");

    // Add the name field.
    var name_box = $("<div></div>");
    name_box.appendTo(this.widget);
    name_box.append("Name:");
    var name_elt = $('<input type="text" value="New Name">');
    name_elt.appendTo(name_box);

    // Add the description field.
    var desc_box = $("<div></div>");
    desc_box.appendTo(this.widget);
    desc_box.append("Description:");
    var desc_elt = $('<textarea width="80" height="4"></textarea>');
    desc_elt.append('Product Description');
    desc_elt.appendTo(desc_box);

    // Add a field for the source, if used.
    this.source_elt = null;
    if (this.variable['source_index'] != undefined) {
        var source = this.source = this.editor.tasting.variables[
            this.variable['source_index']];
        var source_box = $("<div></div>");
        source_box.appendTo(this.widget);
        source_box.append('Source');

        this.source_elt = $('<select></select>');
        this.update_labels();
        this.source_elt.appendTo(source_box);
        source_box.append(' (' + source['name'] + '):');
    }

    // Add the recipient field.
    var rcv_box = $("<div></div>");
    rcv_box.appendTo(this.widget);
    rcv_box.append("Recipient:");
    var rcv_elt = $('<select></select>');
    var tasting = this.editor.tasting;
    for (var i = 0; i != tasting['technicians'].length; ++i) {
        rcv_elt.append("<option>" + tasting['technicians'][i] +
                       "</option>");
    }
    rcv_elt.appendTo(rcv_box);

    // Add the recipient note field.
    var note_box = $("<div></div>");
    note_box.appendTo(this.widget);
    note_box.append("Recipient Note:");
    var note_elt = $('<textarea width="80" height="4"></textarea>');
    note_elt.append('Note for recipient');
    note_elt.appendTo(note_box);

    b = $('<input type="button" value="Cancel">');
    b.appendTo(this.widget);
    b.click(function() {
        self.widget.empty();
        self.widget.remove();
    });

    b = $('<input type="button" value="Submit">');
    b.appendTo(this.widget);
    b.click(function() {
        var source = '';
        if (self.source_elt)
            source = self.source_elt[0].value;

        self.editor.robusta.set_status("adding product...");
        $.getJSON("tasting/" + tasting['id'] + "/add_product",
                  { 'kind' : self.variable['name'],
                    'name' : name_elt[0].value,
                    'description' : desc_elt[0].value,
                    'source' : source,
                    'recipient': rcv_elt[0].value,
                    'note' : note_elt[0].value },
                  function (data) {
                      if (data.result == "ERROR") {
                          self.editor.robusta.set_status(
                              "unable to add product: " + data.error);
                          return;
                      }

                      self.editor.robusta.set_status(
                          "product added, inform recipient!");
                      self.widget.empty();
                      self.widget.remove();
                      self.editor.update_labels();
                      self.editor.update_tickets();
                      array_remove(self.editor.product_editors, self);
                  });
    });

    return this;
}

/* Taste Testing UI */

function TestingWidget(robusta) {
    this.robusta = robusta;
    this.widget = null;
}

TestingWidget.prototype.init = function(parent) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-testing-ui"></div>');
    this.widget.appendTo(parent);

    this.widget.append("taste testing ui");

    return this;
}

TestingWidget.prototype.activate = function() {
    this.widget.show();
}

TestingWidget.prototype.deactivate = function() {
    this.widget.hide();
}

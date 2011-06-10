// Register our initialization function.
window.onload = function() { init(); }

// Global app data.
var g = {};

function init() {
    g.robusta = new Robusta('robusta_ui');
    g.robusta.init();
}

/* Robusta Class */

function Robusta(ui_elt_name) {
    this.ui_elt_name = ui_elt_name;
    this.ui_elt = null;
    this.status_bar = null;
}

Robusta.prototype.init = function() {
    // Locate our UI element.
    this.ui_elt = $("#" + this.ui_elt_name);

    // Add the tastings widget.
    this.tastings_ui = new TastingsWidget(this);
    this.tastings_ui.init(this.ui_elt);

    // Status bar element.
    var sb = $('<div class="robusta-status-bar">Status</div>');
    sb.appendTo(this.ui_elt);
    this.status_bar = sb[0];
}

Robusta.prototype.set_status = function(label) {
    this.status_bar.innerHTML = label;
}

/* Tastings UI Element */

function TastingsWidget(robusta) {
    this.robusta = robusta;
    this.widget = null;
    this.tastings = null;
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

        // Add all the tastings.
        for (var i = 0; i != tastings.length; ++i) {
            var item = tastings[i];

            var tli = new TastingsListItem(item, self);
            var is_selected = item['id'] == self.selected_id;
            tli.init(self.tastings_list, is_selected);

            if (is_selected)
                self.selected_item = tli;
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

TastingsListItem.prototype.init = function(parent, is_selected) {
    var self = this;

    // Create the widget.
    this.widget = $('<div class="robusta-tastings-list-item"></div>');
    this.widget.appendTo(parent);

    // Initialized selected class appropriately.
    if (is_selected) {
        this.widget.toggleClass('selected');
    }

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
    this.list.robusta.set_status("selected: " + this.item['id']);
}

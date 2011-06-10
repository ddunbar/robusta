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
}

Robusta.prototype.init = function() {
    // Locate our UI element.
    this.ui_elt = $("#" + this.ui_elt_name);

    // Add the tastings widget.
    this.tastings_ui = new TastingsWidget(this);
    this.tastings_ui.init(this.ui_elt);
}

/* Tastings UI Element */

function TastingsWidget(robusta) {
    this.robusta = robusta;
    this.widget = null;
}

TastingsWidget.prototype.init = function(parent) {
    this.widget = $('<div class="robusta-tastings-widget"></div>');
    this.widget.appendTo(parent);

    this.widget.append("tastings UI!");
}
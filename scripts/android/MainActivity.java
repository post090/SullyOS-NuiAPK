package com.aetheros.simulator;

import com.capacitorjs.plugins.statusbar.StatusBar;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        // BridgeActivity has installed its layout. Set the final window insets
        // before it starts loading the page, so the welcome screen cannot jump.
        StatusBar statusBar = new StatusBar(this);
        statusBar.setOverlaysWebView(true);
        statusBar.hide();
        statusBar.setStyle("DARK");
        super.load();
    }
}

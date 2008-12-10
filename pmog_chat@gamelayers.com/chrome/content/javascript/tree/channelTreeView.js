/**
 * Implements nsITreeView in Mozilla. Used to build, populate and otherwise control items in the tree
 * without having to add and remove actual treeitem nodes in the DOM.
 * @author marc@gamelayers.com
 */
function channelTreeView() {
  this.userData = {};
  this.channelData = {};
  //this.childData = {};
  this.visibleData = [];
  this.treeBox = null;
  this.selection = null;
  
  this.atomCache = new Object();
  var atomSvc = getService("@mozilla.org/atom-service;1", "nsIAtomService");
  var atoms = ["founder-true", "founder-false", "admin-true", "admin-false",
               "op-true", "op-false", "halfop-true", "halfop-false",
               "voice-true", "voice-false", "away-true", "away-false",
               "unselected", "player-true", "player-false"];
               
   for (var i = 0; i < atoms.length; i++) {
     this.atomCache[atoms[i]] = atomSvc.getAtom(atoms[i]);
   }
}

channelTreeView.prototype = {
  set rowCount(c) {
    throw "rowCount is read only";
  },
  
  get rowCount() {
    return this.visibleData.length;
  },

  setTree: function(treeBox) {
    this.treeBox = treeBox;
  },

  getCellText: function(idx, column) {
    var label;
    try {
      var chan = this.visibleData[idx][0];
      label = chan;
      
      if (SPECIAL_USERS.indexOf(label) != -1) {
        return label;
      }
      
      if (this.isContainer(idx) && this.visibleData[idx][3] === "channel") {
        label = chan.replace(/_/g, ".");
        //var userCount = this.childData[chan].length;
        var userCount = this.channelData[chan].getUsers().size();
        var userLabel = (userCount == 1 ? "user": "users");
        label = label + " (" + userCount + " " + userLabel + ")";
      }
      
      if(!this.isContainer(idx) && this.userData[label].isAway()) {
        label = label + " - " + this.userData[label].getAwayMessage();
      }
      
    } catch(e) {
      label = "";
    }
    return label;
  },

  getChannelName: function(idx) {
    var chan = this.visibleData[idx][0];
    chan = chan.replace(/_/g, ".");

    if (this.visibleData[idx][3] === "channel") {
      chan = "#" + chan;
    }
    return chan;
  },

  getChannelKey: function(idx) {
    return this.visibleData[idx][0];
  },

  isContainer: function(idx) {
    var container = false;
    var text = this.visibleData[idx][0];
    text = this.cleanChannel(text);
    
    if (SPECIAL_USERS.indexOf(text) != -1) {
      return false;
    }

    if (this.channelData[text] && !this.channelData[text].isPrivateChat()) {
      container = true;
    }
    // try {
    //   container = this.visibleData[idx][1];
    // } catch(e) {
    //   container = false;
    // }
    return container;
  },
  
  isContainerOpen: function(idx) {
    return this.visibleData[idx][2];
  },
  
  isContainerEmpty: function(idx) {
    var isEmpty = false;
    var text = this.visibleData[idx][0];
    
    if (this.channelData[text].isPrivateChat()) {
      isEmpty = true;
    }
    
    return isEmpty;
  },
  
  isSeparator: function(idx) {
    return false;
  },
  
  isSorted: function() {
    return false;
  },
  
  isEditable: function(idx, column) {
    return false;
  },

  getParentIndex: function(idx) {
    var pIndex;
    
    if (this.isContainer(idx)) {
      pIndex = - 1;
    }
    
    for (var t = idx - 1; t >= 0; t--) {
      if (this.isContainer(t)) {
        pIndex = t;
      }
    }
    return pIndex;
  },
  
  getLevel: function(idx) {
    var text = this.visibleData[idx][0];
    
    if (SPECIAL_USERS.indexOf(text) != -1) {
      return 0;
    }
    
    if (this.isContainer(idx)) {
      return 0;
    }
    return 1;
  },
  
  hasNextSibling: function(idx, after) {
    var hasNext = false;
    var thisLevel = this.getLevel(idx);
    for (var t = idx + 1; t < this.visibleData.length; t++) {
      var nextLevel = this.getLevel(t);
      if (nextLevel === thisLevel) {
        hasNext = true;
      }
    }
    return hasNext;
  },
  
  toggleOpenState: function(idx) {
    var item = this.visibleData[idx];
    if (!item[1]) {
      return;
    }

    if (item[2]) {
      item[2] = false;

      var thisLevel = this.getLevel(idx);
      var deletecount = 0;
      for (var t = idx + 1; t < this.visibleData.length; t++) {
        if (this.getLevel(t) > thisLevel) {
          deletecount++;
        } else {
          break;
        }
      }
      if (deletecount) {
        this.visibleData.splice(idx + 1, deletecount);
        this.treeBox.rowCountChanged(idx + 1, -deletecount);
      }
    } else {
      item[2] = true;

      var label = this.visibleData[idx][0];
      //var toinsert = this.childData[label];
      var toinsert = this.channelData[label].sortUsers();
      for (var i = 0; i < toinsert.length; i++) {
        this.visibleData.splice(idx + i + 1, 0, [toinsert[i], false, false]);
      }
      this.treeBox.rowCountChanged(idx + 1, toinsert.length);
    }
  },

  setAvatar: function(player, avatarPath) {
    if (player !== null) {
      channelTreeView.userData[player].setAvatar(avatarPath);
      channelTreeView.treeBox.invalidate();
    }
  },

  getImageSrc: function(idx, column) {
    var avPath = null;
    var text = this.visibleData[idx][0];
    
    if (SPECIAL_USERS.indexOf(text) != -1) {
      return;
    }
    
    if (this.isContainer(idx) && this.visibleData[idx][3] === "channel") {
      var chan = this.visibleData[idx][0].replace(/_/g, ".");
      avPath = Peekko.session.window.getFavicon(chan);
    } else {
      var playerName = this.getCellText(idx);
      if (playerName.indexOf(" - ") != -1) {
        playerName = playerName.split(" - ")[0];
      }
      
      // if (!this.userData[playerName]) {
      //   this.userData[playerName] = new User(playerName);
      // }
      
      if (this.userData[playerName].getAvatar()) {
        avPath = this.userData[playerName].getAvatar();
      } else {
        Peekko.session.window.getAvatar(playerName, this.setAvatar);
      }
    }
    return avPath;
  },
  getProgressMode: function(idx, column) {},
  
  getCellValue: function(idx, column) {},
  
  cycleHeader: function(col, elem) {},
  
  selectionChanged: function() {},
  
  cycleCell: function(idx, column) {},
  
  performAction: function(action) {},
  
  performActionOnCell: function(action, index, column) {},
  
  getRowProperties: function(idx, column, properties) {
    //if ((idx < 0) || (idx >= this.childData.length) || !properties) {
    if ((idx < 0) || !properties) {
      return;
    }

    // See bug 432482 - work around Gecko deficiency.
    if (!this.selection.isSelected(idx)) {
        properties.AppendElement(this.atomCache["unselected"]);
    }
    
    properties.AppendElement(this.atomCache["player-true"]);
  },
  
  getCellProperties: function(idx, column, properties) {
    //if ((idx < 0) || (idx >= this.childData.length) || !properties) {
    if ((idx < 0) || !properties) {
      return;
    }

    // See bug 432482 - work around Gecko deficiency.
    if (!this.selection.isSelected(idx)) {
        properties.AppendElement(this.atomCache["unselected"]);
    }

    var rowName = this.visibleData[idx][0];
    var neither = SPECIAL_USERS.indexOf(rowName) != -1;
    if (!this.isContainer(idx) && !neither) {
      var parentChannel = this.visibleData[this.getParentIndex(idx)][0];
      var userObj = this.userData[rowName];
      if (userObj) {
        properties.AppendElement(this.atomCache["op-" + userObj.isOpInChannel(parentChannel)]);
        properties.AppendElement(this.atomCache["away-" + userObj.isIdle()]);
        properties.AppendElement(this.atomCache["player-true"]);
        // Some stuff we could implement in the future...
        //properties.AppendElement(this.atomCache["voice-" + userObj.isVoice]);
        //properties.AppendElement(this.atomCache["halfop-" + userObj.isHalfOp]);
        //properties.AppendElement(this.atomCache["admin-" + userObj.isAdmin]);
        //properties.AppendElement(this.atomCache["founder-" + userObj.isFounder]);
      }
    } else {
      properties.AppendElement(this.atomCache["player-false"]);
    }
  },
  
  getColumnProperties: function(column, element, prop) {},

  cleanChannel: function(channelName) {
    return channelName.replace(/\./g, "_").replace(/#/, '');
  },

  addRow: function(containerName, value) {
    var index;
    for (var i = 0; i < this.visibleData.length; i++) {
      if (this.visibleData[i][0] == containerName) {
        index = i;
      }
    }

    if (index !== undefined) {
      var label = this.visibleData[index][0];
      var toinsert = this.channelData[label];

      if (this.isContainerOpen(index)) {
        this.visibleData.splice(index + toinsert.sortUsers().length, 0, [value, false]);
        this.treeBox.rowCountChanged(index + toinsert.sortUsers().length - 1, 1);
        this.treeBox.invalidate();
      }
    }
  },

  addChannel: function(name, type) {
    name = this.cleanChannel(name);
    type = type || "channel";
    var open = (type == "channel" ? true: false);
    
    if (!this.channelData[name]) {
      this.channelData[name] = new TreeChannel(name, { type: type });
      this.visibleData.push([name, true, open, type]);
      this.treeBox.rowCountChanged(this.visibleData.length - 1, 1);
    }
    return true;
  },

  removeChannel: function(name) {
    name = this.cleanChannel(name);

    // Get the index of the channel name from the visibleData array
    var visIndex;
    for (var i = 0; i < this.visibleData.length; i++) {
      if (this.isContainer(i) && this.visibleData[i][0] === name) {
        visIndex = i;
      }
    }

    // Count up all the items to be removed from the list. Starting with a count of 1 for the channel node
    // and adding each child of that channel to the total count to be removed.
    var thisLevel = this.getLevel(visIndex);
    var deletecount = 1;
    for (var t = visIndex + 1; t < this.visibleData.length; t++) {
      if (this.getLevel(t) > thisLevel) {
        deletecount++;
      } else {
        break;
      }
    }

    // If we've got stuff to delete, remove the items and update the view.'
    if (deletecount) {
      this.visibleData.splice(visIndex, deletecount);
      this.treeBox.rowCountChanged(visIndex, -deletecount);
    }
    
    for (var u in this.channelData[name].getUsers()) {
      u.removeChannel(name);
    }
    
    if (this.channelData[name]) {
      delete this.channelData[name];
    }
  },

  addPlayer: function(channel, player) {
    channel = this.cleanChannel(channel);
    if (!this.channelData[channel]) {
      this.addChannel(channel);
    }
    
    var isOp = /^(@|&)/.test(player);
    var noOpSymb = player;
    if (isOp) {
      noOpSymb = player.replace(/^(@|&)/, ""); 
    }
    
    if (!this.userData[noOpSymb]) {
      this.userData[noOpSymb] = new User(noOpSymb, { isIdle: false });
    }
    
    this.userData[noOpSymb].addChannel(channel, isOp);
    this.channelData[channel].addUser(noOpSymb);
    this.addRow(channel, noOpSymb);
  },

  hasChannel: function(name) {
    name = this.cleanChannel(name);
    var matching = false;
    if (this.channelData[name]) {
      matching = true;
    }
    return matching;
  },

  hasChild: function(name) {
    var matching = false;
    for (var i = 0; i < this.visibleData.length; i++) {
      if (this.isContainer(i) && this.visibleData[i][0] === name && this.isContainer(i)) {
        matching = true;
      }
    }
    return matching;
  },

  getRowIndex: function(name) {
    var index;
    for (var i = this.visibleData.length - 1; i >= 0; i--) {
      if (this.visibleData[i][0] === name) {
        index = i;
        break;
      }
    }
    return index;
  },

  removePlayer: function(channel, name) {
    channel = this.cleanChannel(channel);
    
    // Get the index of the channel name from the visibleData array
    var visIndex;
    for (var i = 0; i < this.visibleData.length; i++) {
      if (this.isContainer(i) && this.visibleData[i][0] === channel) {
        visIndex = i;
      }
    }

    // Count up all the items to be removed from the list. Starting with a count of 1 for the channel node
    // and adding each child of that channel to the total count to be removed.
    var thisLevel = this.getLevel(visIndex);
    for (var t = visIndex + 1; t < this.visibleData.length; t++) {
      if (this.getLevel(t) > thisLevel && this.getCellText(t) === name) {
        this.visibleData.splice(t, 1);
        this.treeBox.rowCountChanged(t, -1);
      }
    }

    this.channelData[channel].removeUser(name);

    // Finally, remove them from the actual data collection so we don't get them again.'
    //if (this.childData[channel]) {
    if (this.userData[name]) {
      //var index = this.childData[channel].indexOf(name);
      delete this.userData[name];
    //this.childData[channel].splice(index, 1);
    }
  },
};

/**
 * Initializes the tree view of channels and users. 
 * It's essential that this runs, otherwise the tree won't work
 */

function init() {
  channelTreeView = new channelTreeView();
  var channelTree = document.getElementById("elementList");
  channelTree.view = channelTreeView;

  channelTree.addEventListener("dblclick", treeDoubleClick, false);
  channelTree.addEventListener("click", selectTreeChannel, false);
}

/**
 * Opens a private chat with the user that was double clicked in the tree.
 * Only executes if the item double clicked is not a channel container but an
 * actual player name.
 * @param {Object} event The double click event fired by the tree.
 */

function treeDoubleClick(event) {
  if (event.button === 0 && event.target.tagName === "treechildren") {
    var selectedIndex = channelTreeView.treeBox.view.selection.currentIndex;
    var selectedText = channelTreeView.getCellText(selectedIndex);
    if (!channelTreeView.isContainer(selectedIndex)) {
      var chatTab = Peekko.session.window.getChannelTab(selectedText);
      if (chatTab === undefined) {
        chatTab = Peekko.session.window.addTab(channelTreeView.getCellText(selectedIndex));
      }
      Peekko.session.window.selectTab(chatTab);
    }
  }
}

/**
 * Selects the chat tab associated with the selected element if the selected element is a channel container in the tree
 * @param {Object} event The select event fired by the tree.
 */
function selectTreeChannel(event) {
  if (channelTreeView.visibleData.length <= 0) {
    return;
  }
  
  if (event.target.tagName !== "treechildren") {
    channelTreeView.selection.select(-1);
    return;
  }
  var selectedIndex = channelTreeView.treeBox.view.selection.currentIndex;
  var selectedText = channelTreeView.getChannelName(selectedIndex);

  if (channelTreeView.isContainer(selectedIndex)) {
    var chatTab = Peekko.session.window.getChannelTab(selectedText);
    Peekko.session.window.tabcontainer.selectedTab = chatTab;
  }
}

/**
 * Checks the selected item in the tree and ensures it is a player item and not a channel container.
 * If it isn't a valid node then it prevents the context menu popup from showing.
 * @param {Object} event The onpopupshowing event fired by the tree.
 */
function validateSelection(event) {
  if (channelTreeView.rowCount <= 0 || channelTreeView.isContainer(channelTreeView.treeBox.view.selection.currentIndex)) {
    event.preventDefault();
  }
}

/**
  This gets called automatically when the chat window is opened. It listens for the load event from
  the window and when that happens, it calls the init function above.
 */
window.addEventListener("load", init, false);
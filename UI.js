var contrib = require('blessed-contrib')
var blessed = require('blessed')
var fs = require('fs');

var screen = blessed.screen()

var UI = {};


// Initialize UI objects
UI.init = function (gameManipulator, learner) {
  UI.gm = gameManipulator;
  UI.learner = learner;

  UI.grid = new contrib.grid({
    rows: 12,
    cols: 6,
    screen: screen
  });


  // Build Sensor inputs
  UI.uiSensors = UI.grid.set(0, 0, 3, 6, contrib.bar, {
    label: 'Network Inputs',
    // bg: 'white',
    barWidth: 12,
    barSpacing: 1,
    xOffset: 0,
    maxHeight: 100,
  });


  // Build Log box
  UI.logger = UI.grid.set(3, 0, 3, 6, contrib.log, {
    fg: 'green',
    selectedFg: 'green',
    label: 'Logs'
  });


  // Current score/time view
  UI.uiScore = UI.grid.set(6, 0, 3, 3, blessed.Text, {
    label: 'Game Stats',
    // bg: 'green',
    fg: 'white',
    content: 'Loading...',
    align: 'center',
  });


  // Current Genomes stats
  UI.uiGenomes = UI.grid.set(6, 3, 3, 3, blessed.Text, {
    label: 'Genome Stats',
    // bg: 'green',
    fg: 'white',
    content: 'Hey!',
    align: 'center',
  });


  // Load Tree
  UI.savesTree = UI.grid.set(9, 0, 3, 3, contrib.tree, {
    label: 'Saved Genomes',
  });


  // Callback for Loading genomes and focusing tree
  UI.savesTree.on('click', UI.savesTree.focus.bind(UI.savesTree));
  UI.savesTree.on('select', function (item){

    if (item.isFile) {
      var fileName = item.name;

      UI.logger.log('Loading genomes from file:');
      UI.logger.log(fileName);

      var genomes = require('./genomes/'+fileName);

      UI.learner.loadGenomes(genomes);
    } else {
      UI.refreshFiles();
    }
  });

  UI.refreshFiles();


  // Save Btn
  UI.btnSave = UI.grid.set(9, 3, 3, 3, blessed.box, {
    label: 'Save to File',
    bg: 'green',
    fg: 'red',
    content: '\n\n\n\nSave Genomes',
    align: 'center',
  });

  UI.btnSave.on('click', function (){

    var jsonGenomes = [];
    for (var k in UI.learner.genomes) {
      jsonGenomes.push(UI.learner.genomes[k].toJSON());
    }

    UI.logger.log('Saving '+jsonGenomes.length+' genomes...');

    var dir = './genomes';
    var fileName = dir + '/gen_'+UI.learner.generation+'_'+Date.now()+'.json';
    fs.writeFile(fileName, JSON.stringify(jsonGenomes), function (err){
      if (err) {
        UI.logger.log('Failed to save! '+err);
      } else {
        UI.logger.log('Saved to '+fileName);
      }

      UI.refreshFiles();
    });

  });

  screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
  });

  screen.key(['s'], function (ch, key){
    if (learner.state == 'STOP') {
      learner.state = 'LEARNING';
      gameManipulator.focusGame();
      learner.startLearning();
    } else {
      learner.state = 'STOP';
    }
  });

  screen.render()
};


// Read entire folder and select files that match a .json file
UI.refreshFiles = function (){
  var files = [];
  var fileData = {
    name: 'Saved Files',
    extended: true,
    children: [{
      name: 'Refresh Folders'
    }]
  };

  // Populate tree
  UI.logger.log('Reading genomes dir...')
  var files = fs.readdirSync('./genomes');
  for (var k in files) {
    if (files[k].indexOf('.json') >= 0) {
      
      fileData.children.push({
        name: files[k],
        isFile: true,
      });

    }
  }

  UI.savesTree.setData(fileData);
}


// Updates data on the screen and render it
UI.render = function () {

  // Update data
  UI.uiSensors.setData({
    titles: ['Distance', 'Size', 'Speed', 'Activation'],
    data: [
      Math.round(UI.gm.sensors[0].value * 100),
      Math.round(UI.gm.sensors[0].size * 100),
      Math.round(UI.gm.sensors[0].speed * 100),
      Math.round(UI.gm.gameOutput * 100),
    ]
  })

  // Set Genome stats and score
  var learn = UI.learner;
  var uiStats = '';
  uiStats += 'Status: ' + learn.state + '\n';
  uiStats += 'Fitness: ' + UI.gm.points + '\n';
  uiStats += 'GameStatus: ' + UI.gm.gamestate + '\n';
  uiStats += 'Generation: ' + learn.generation;
  uiStats += ' : ' + learn.genome + '/' + learn.genomes.length;
  UI.uiScore.setText(uiStats);

  if (UI.gm.gameOutput) {
    var str = '';
    str += 'Action: ' + UI.gm.gameOutputString + '\n'
    str += 'Activation: ' + UI.gm.gameOutput;
    UI.uiGenomes.setText(str);
  } else {
    UI.uiGenomes.setText('Loading...');
  }

  // Render screen
  screen.render();
}

// Continuously render screen
setInterval(UI.render, 25);

module.exports = UI;
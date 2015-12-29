var synaptic = require('synaptic');
var async = require('async');
var _ = require('lodash');

var Architect = synaptic.Architect;
var Network = synaptic.Network;


var Learn = {

  // Array of networks for current Genomes
  // (Genomes will be added the key `fitness`)
  genomes: [],

  // Current state of learning [STOP, LEARNING]
  state: 'STOP',

  // Current genome/generation tryout
  genome: 0,
  generation: 0,

  // Set this, to verify genome experience BEFORE running it
  shouldCheckExperience: false,

};


// Initialize the Learner
Learn.init = function (gameManip, ui, genomeUnits, selection, mutationProb) {
  Learn.gm = gameManip;
  Learn.ui = ui;

  Learn.genome = 0;
  Learn.generation = 0;

  Learn.genomeUnits = genomeUnits;
  Learn.selection = selection;
  Learn.mutationProb = mutationProb;
}


// Build genomes before calling executeGeneration.
Learn.startLearning = function () {

  // Build genomes if needed
  while (Learn.genomes.length < Learn.genomeUnits) {
    Learn.genomes.push(Learn.buildGenome(3, 1));
  }

  Learn.executeGeneration();
  
}


// Given the entire generation of genomes (An array),
// applyes method `executeGenome` for each element.
// After all elements have completed executing:
// 
// 1) Select best genomes
// 2) Does cross over (except for 2 genomes)
// 3) Does Mutation-only on remaining genomes
// 4) Execute generation (recursivelly)
Learn.executeGeneration = function (){
  if (Learn.state == 'STOP') {
    return;
  }

  Learn.generation++;
  Learn.ui.logger.log('Executing generation '+Learn.generation);

  Learn.genome = 0;

  async.mapSeries(Learn.genomes, Learn.executeGenome, function (argument) {

    // Kill worst genomes
    Learn.genomes = Learn.selectBestGenomes(Learn.selection);

    // Copy best genomes
    var bestGenomes = _.clone(Learn.genomes);

    // Cross Over ()
    while (Learn.genomes.length < Learn.genomeUnits - 2) {
      // Get two random Genomes
      var genA = _.sample(bestGenomes).toJSON();
      var genB = _.sample(bestGenomes).toJSON();

      // Cross over and Mutate
      var newGenome = Learn.mutate(Learn.crossOver(genA, genB));

      // Add to generation
      Learn.genomes.push(Network.fromJSON(newGenome));
    }

    // Mutation-only
    while (Learn.genomes.length < Learn.genomeUnits) {
      // Get two random Genomes
      var gen = _.sample(bestGenomes).toJSON();

      // Cross over and Mutate
      var newGenome = Learn.mutate(gen);

      // Add to generation
      Learn.genomes.push(Network.fromJSON(newGenome));
    }

    Learn.ui.logger.log('Completed generation '+Learn.generation);

    // Execute next generation
    Learn.executeGeneration();
  })
}


// Sort all the genomes, and delete the worst one
// untill the genome list has selectN elements.
Learn.selectBestGenomes = function (selectN){
  var selected = _.sortBy(Learn.genomes, 'fitness').reverse();

  while (selected.length > selectN) {
    selected.pop();
  }

  Learn.ui.logger.log('Fitness: '+_.pluck(selected, 'fitness').join(','));

  return selected;
}


// Waits the game to end, and start a new one, then:
// 1) Set's listener for sensorData
// 2) On data read, applyes the neural network, and
//    set it's output
// 3) When the game has ended and compute the fitness
Learn.executeGenome = function (genome, next){
  if (Learn.state == 'STOP') {
    return;
  }

  Learn.genome = Learn.genomes.indexOf(genome) + 1;
  // Learn.ui.logger.log('Executing genome '+Learn.genome);

  // Check if genome has AT LEAST some experience
  if (Learn.shouldCheckExperience) {
    if (!Learn.checkExperience(genome)) {
      genome.fitness = 0;
      // Learn.ui.logger.log('Genome '+Learn.genome+' has no min. experience');
      return next();
    }
  }

  Learn.gm.startNewGame(function (){

    // Reads sensor data, and apply network
    Learn.gm.onSensorData = function (){
      var inputs = [
        Learn.gm.sensors[0].value,
        Learn.gm.sensors[0].size,
        Learn.gm.sensors[0].speed,
      ];
      // console.log(inputs);
      // Apply to network
      var outputs = genome.activate(inputs);

      Learn.gm.setGameOutput(outputs[0]);
    }

    // Wait game end, and compute fitness
    Learn.gm.onGameEnd = function (points){
      Learn.ui.logger.log('Genome '+Learn.genome+' ended. Fitness: '+points);

      // Save Genome fitness
      genome.fitness = points;

      // Go to next genome
      next();
    }
  });

}


// Validate if any acction occur uppon a given input (in this case, distance).
// If genome only keeps a single activation value for any given input,
// it will return false
Learn.checkExperience = function (genome) {
  
  var step = 0.1, start = 0.0, stop = 1;

  // Inputs are default. We only want to test the first index
  var inputs = [0.0, 0.3, 0.2];
  var activation, state, outputs = {};

  for (var k = start; k < stop; k += step) {
    inputs[0] = k;

    activation = genome.activate(inputs);
    state = Learn.gm.getDiscreteState(activation);
    
    outputs[state] = true;
  }

  // Count states, and return true if greater than 1
  return _.keys(outputs).length > 1;
}


// Load genomes saved from JSON file
Learn.loadGenomes = function (genomes, deleteOthers){
  if (deleteOthers) {
    Learn.genomes = [];
  }

  var loaded = 0;
  for (var k in genomes) {
    Learn.genomes.push(Network.fromJSON(genomes[k]));
    loaded++;
  }

  Learn.ui.logger.log('Loaded '+loaded+' genomes!');
}


// Builds a new genome based on the 
// expected number of inputs and outputs
Learn.buildGenome = function (inputs, outputs) {
  Learn.ui.logger.log('Build genome '+(Learn.genomes.length+1));

  var network = new Architect.Perceptron(inputs, 4, 4, outputs);

  return network;
}


// SPECIFIC to Neural Network.
// Those two methods convert from JSON to Array, and from Array to JSON
Learn.crossOver = function (netA, netB) {
  // Swap (50% prob.)
  if (Math.random() > 0.5) {
    var tmp = netA;
    netA = netB;
    netB = tmp;
  }

  // Clone network
  netA = _.cloneDeep(netA);
  netB = _.cloneDeep(netB);

  // Cross over data keys
  Learn.crossOverDataKey(netA.neurons, netB.neurons, 'bias');

  return netA;
}


// Does random mutations across all
// the biases and weights of the Networks
// (This must be done in the JSON to
// prevent modifying the current one)
Learn.mutate = function (net){
  // Mutate
  Learn.mutateDataKeys(net.neurons, 'bias', Learn.mutationProb);
  
  Learn.mutateDataKeys(net.connections, 'weight', Learn.mutationProb);

  return net;
}


// Given an Object A and an object B, both Arrays
// of Objects:
// 
// 1) Select a cross over point (cutLocation)
//    randomly (going from 0 to A.length)
// 2) Swap values from `key` one to another,
//    starting by cutLocation
Learn.crossOverDataKey = function (a, b, key) {
  var cutLocation = Math.round(a.length * Math.random());

  var tmp;
  for (var k = cutLocation; k < a.length; k++) {
    // Swap
    tmp = a[k][key];
    a[k][key] = b[k][key];
    b[k][key] = tmp;
  }
}


// Given an Array of objects with key `key`,
// and also a `mutationRate`, randomly Mutate
// the value of each key, if random value is
// lower than mutationRate for each element.
Learn.mutateDataKeys = function (a, key, mutationRate){
  for (var k = 0; k < a.length; k++) {
    // Should mutate?
    if (Math.random() > mutationRate) {
      continue;
    }

    a[k][key] += a[k][key] * (Math.random() - 0.5) * 3 + (Math.random() - 0.5);
  }
}


module.exports = Learn;
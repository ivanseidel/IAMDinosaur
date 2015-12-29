var robot = require('robotjs');

// Cache screen size
var screenSize = robot.getScreenSize();

var Scanner = require ('./Scanner');

// COLOR DEFINITIONS
// This is the Dino's colour, also used by Obstacles.
var COLOR_DINOSAUR = '535353';


var GameManipulator = {

  // Stores the game position (Globally)
  offset: null,
  width: null,

  // Stores points (jumps)
  points: 0,

  // Listners
  onGameEnd: null,
  onGameStart: null,
  onSensorData: null,

  // Game State
  gamestate: 'OVER',

  // GameOver Position
  gameOverOffset: [190, -82],

  // Stores an array of "sensors" (Ray tracings)
  // Positions are always relative to global "offset"
  sensors: [
    {
      lastValue: 1,

      value: null,
      offset: [84, -15], // 64,-15
      step: [4, 0],
      length: 0.3,

      // Speed
      speed: 0,
      lastComputeSpeed: 0,

      // Computes size of the object
      size: 0,
      computeSize: true,
    },
  ]
};


// Find out dinosaur (fast)
GameManipulator.findGamePosition = function () {
  var pos, dinoPos, skipXFast = 15;

  for (var x = 20; x < screenSize.width; x+= skipXFast) {
    dinoPos = Scanner.scanUntil(
      // Start position
      [x, 80],
      // Skip pixels
      [0, skipXFast],
      // Searching Color
      COLOR_DINOSAUR,
      // Normal mode (not inverse)
      false,
      // Iteration limit
      500 / skipXFast);

    if (dinoPos) {
      break;
    }
  }

  if (!dinoPos) {
    return null;
  }

  for (var x = dinoPos[0] - 50; x <= dinoPos[0]; x += 1) {
    pos = Scanner.scanUntil(
      // Start position
      [x, dinoPos[1] - 2],
      // Skip pixels
      [0, 1],
      // Searching Color
      COLOR_DINOSAUR,
      // Normal mode (not inverse)
      false,
      // Iteration limit
      100);

    if (pos) {
      break;
    }
  }

  // Did actually found? If not, error!
  if (!pos) {
    return null;
  }

  // Find the end of the game
  var endPos = pos;

  while (robot.getPixelColor(endPos[0] + 3, endPos[1]) == COLOR_DINOSAUR) {
     endPos = Scanner.scanUntil(
        // Start position
        [endPos[0] + 2, endPos[1]],
        // Skip pixels
        [2, 0],
        // Searching Color
        COLOR_DINOSAUR,
        // Invert mode
        true,
        // Iteration limit
        600);
  }

  // Did actually found? If not, error!
  if (!endPos) {
    return null;
  }

  // Save to allow global access
  GameManipulator.offset = pos;
  GameManipulator.width = 600;//endPos[0] - pos[0];

  return pos;
};


// Read Game state
// (If game is ended or is playing)
GameManipulator.readGameState = function () {
  // Read GameOver
  var found = Scanner.scanUntil(
    [
      GameManipulator.offset[0] + GameManipulator.gameOverOffset[0],
      GameManipulator.offset[1] + GameManipulator.gameOverOffset[1]
    ],

    [2, 0], COLOR_DINOSAUR, false, 20);

  if (found && GameManipulator.gamestate != 'OVER') {
    GameManipulator.gamestate = 'OVER';

    // Clear keys
    GameManipulator.setGameOutput(0.5);

    // Trigger callback and clear
    GameManipulator.onGameEnd && GameManipulator.onGameEnd(GameManipulator.points);
    GameManipulator.onGameEnd = null;

    // console.log('GAME OVER: '+GameManipulator.points);

  } else if (!found && GameManipulator.gamestate != 'PLAYING') {
    GameManipulator.gamestate = 'PLAYING';

    // Clear points
    GameManipulator.points = 0;
    GameManipulator.lastScore = 0;

    // Clear keys
    GameManipulator.setGameOutput(0.5);

    // Clear sensors
    GameManipulator.sensors[0].lastComputeSpeed = 0;
    GameManipulator.sensors[0].lastSpeeds = [];
    GameManipulator.sensors[0].lastValue = 1;
    GameManipulator.sensors[0].value = 1;
    GameManipulator.sensors[0].speed = 0;
    GameManipulator.sensors[0].size = 0;

    // Clar Output flags
    GameManipulator.lastOutputSet = 'NONE';

    // Trigger callback and clear
    GameManipulator.onGameStart && GameManipulator.onGameStart();
    GameManipulator.onGameStart = null;

    // console.log('GAME RUNNING '+GameManipulator.points);
  }
}


// Call this to start a fresh new game
// Will wait untill game has ended,
// and call the `next` callback
var _startKeyInterval;
GameManipulator.startNewGame = function (next) {

  // Refresh state
  GameManipulator.readGameState();

  // If game is already over, press space
  if (GameManipulator.gamestate == 'OVER') {
    clearInterval(_startKeyInterval);

    // Set start callback
    GameManipulator.onGameStart = function (argument) {
      clearInterval(_startKeyInterval);
      next && next();
    };

    // Press space to begin game (repetidelly)
    _startKeyInterval = setInterval(function (){
      robot.keyTap(' ');
    }, 300);

    // Refresh state
    GameManipulator.readGameState();

  } else {
    // Wait die, and call recursive action
    GameManipulator.onGameEnd = function () {
      GameManipulator.startNewGame(next);
    }
  }


}


// Compute points based on sensors
//
// Basicaly, checks if an object has
// passed trough the sensor and the
// value is now higher than before
GameManipulator.computePoints = function () {
  for (var k in GameManipulator.sensors) {
    var sensor = GameManipulator.sensors[k];

    if (sensor.value > 0.5 && sensor.lastValue < 0.3) {
      GameManipulator.points++;
      // console.log('POINTS: '+GameManipulator.points);
    }
  }
}


// Read sensors
//
// Sensors are like ray-traces:
//   They have a starting point,
//   and a limit to search for.
//
// Each sensor can gatter data about
// the DISTANCE of the object, it's
// SIZE and it's speed
//
// Note: We currently only have a sensor.
GameManipulator.readSensors = function () {
  var offset = GameManipulator.offset;

  var startTime = Date.now();

  for (var k in GameManipulator.sensors) {

    var sensor = GameManipulator.sensors[k];

    // Calculate absolute position of ray tracing
    var start = [
      offset[0] + sensor.offset[0],
      offset[1] + sensor.offset[1],
    ];

    // Compute cursor forwarding
    var forward = sensor.value * GameManipulator.width * 0.8 * sensor.length;

    var end = Scanner.scanUntil(
      // console.log(
        // Start position
        [start[0], start[1]],
        // Skip pixels
        sensor.step,
        // Searching Color
        COLOR_DINOSAUR,
        // Invert mode?
        false,
        // Iteration limit
        (GameManipulator.width * sensor.length) / sensor.step[0]);

    // Save lastValue
    sensor.lastValue = sensor.value;

    // Calculate the Sensor value
    if (end) {
      sensor.value = (end[0] - start[0]) / (GameManipulator.width * sensor.length);

      // Calculate size of obstacle
      var endPoint = Scanner.scanUntil(
        [end[0] + 75, end[1]],
        [-2, 0],
        COLOR_DINOSAUR,
        false,
        75 / 2
      );

      // If no end point, set the start point as end
      if (!endPoint) {
        endPoint = end;
      }

      var sizeTmp = (endPoint[0] - end[0]) / 100.0;
      if (GameManipulator.points == sensor.lastScore) {
        // It's the same obstacle. Set size to "max" of both
        sensor.size = Math.max(sensor.size, sizeTmp);
      } else {
        sensor.size = sizeTmp;
      }


      // We use the current score to check for object equality
      sensor.lastScore = GameManipulator.points;

      // sensor.size = Math.max(sensor.size, endPoint[0] - end[0]);

    } else {
      sensor.value = 1;
      sensor.size = 0;
    }

    // Compute speed
    var dt = (Date.now() - sensor.lastComputeSpeed) / 1000;
    sensor.lastComputeSpeed = Date.now();

    if (sensor.value < sensor.lastValue) {
      // Compute speed
      var newSpeed = (sensor.lastValue - sensor.value) / dt;

      sensor.lastSpeeds.unshift(newSpeed);

      while (sensor.lastSpeeds.length > 10) {
        sensor.lastSpeeds.pop();
      }

      // Take Average
      var avgSpeed = 0;
      for (var k in sensor.lastSpeeds) {
        avgSpeed += sensor.lastSpeeds[k] / sensor.lastSpeeds.length;
      }

      sensor.speed = Math.max(avgSpeed - 1.5, sensor.speed);

    }

    // Save length/size of sensor value
    sensor.size = Math.min(sensor.size, 1.0);

    startTime = Date.now();
  }

  // Compute points
  GameManipulator.computePoints();

  // Call sensor callback (to act)
  GameManipulator.onSensorData && GameManipulator.onSensorData();
}


// Set action to game
// Values:
//  0.00 to  0.45: DOWN
//  0.45 to  0.55: NOTHING
//  0.55 to  1.00: UP (JUMP)
var PRESS = 'down';
var RELEASE = 'up';

GameManipulator.lastOutputSet = 'NONE';
GameManipulator.lastOutputSetTime = 0;

GameManipulator.setGameOutput = function (output){

  GameManipulator.gameOutput = output;
  GameManipulator.gameOutputString = GameManipulator.getDiscreteState(output);

  if (GameManipulator.gameOutputString == 'DOWN') {
    // Skew
    robot.keyToggle('up', RELEASE);
    robot.keyToggle('down', PRESS);
  } else if (GameManipulator.gameOutputString == 'NORM') {
    // DO Nothing
    robot.keyToggle('up', RELEASE);
    robot.keyToggle('down', RELEASE);
  } else {

    // Filter JUMP
    if (GameManipulator.lastOutputSet != 'JUMP') {
      GameManipulator.lastOutputSetTime = Date.now();
    }

    // JUMP
    // Check if hasn't jump for more than 3 continuous secconds
    if (Date.now() - GameManipulator.lastOutputSetTime < 3000) {
      robot.keyToggle('up', PRESS);
      robot.keyToggle('down', RELEASE);
    } else {
      robot.keyToggle('up', RELEASE);
      robot.keyToggle('down', RELEASE);
    }

  }

  GameManipulator.lastOutputSet = GameManipulator.gameOutputString;
}


//
// Simply maps an real number to string actions
//
GameManipulator.getDiscreteState = function (value){
  if (value < 0.45) {
    return 'DOWN'
  } else if(value > 0.55) {
    return 'JUMP';
  }

  return 'NORM';
}


// Click on the Starting point
// to make sure game is focused
GameManipulator.focusGame = function (){
  robot.moveMouse(GameManipulator.offset[0], GameManipulator.offset[1]);
  robot.mouseClick('left');
}

module.exports = GameManipulator;
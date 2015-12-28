/*
	Developed by Ivan Seidel [https://github.com/ivanseidel]
*/

var UI = require('./UI');
var robot = require('./robotjs');
var Learner = require('./Learner');
var scanner = require('./scanner');
var GameManipulator = require('./GameManipulator');

// 
// Configure Robotjs
// 
robot.setMouseDelay(1);


// 
// Initialize Game
// 
GameManipulator.findGamePosition();


// 
// Check for found game
// 
if(GameManipulator.offset){
	// Uncomment this line to debug the
	// starting point (Check if it's detecting it correcly)
	
	// robot.moveMouse(GameManipulator.offset[0]+GameManipulator.sensors[0].offset[0],
	// 		GameManipulator.offset[1] + GameManipulator.sensors[0].offset[1]);

	robot.moveMouse(GameManipulator.offset[0], GameManipulator.offset[1]);
}else{
	console.error('FAILED TO FIND GAME!');
	process.exit();
}


// 
// Initialize UI
// 
UI.init(GameManipulator, Learner);

// 
// Init Learner
// 
Learner.init(GameManipulator, UI, 12, 4, 0.2);


// 
// Start reading game state and sensors
// 
setInterval(GameManipulator.readSensors, 40);
setInterval(GameManipulator.readGameState, 200);


// 
// Start game (Example of API usage)
// 
/*
function startGame () {
	var game = Math.round(Math.random() * 100);

	UI.logger.log('Queuing start... ', game);

	GameManipulator.startNewGame(function() {
		UI.logger.log('Game HAS started!', game);
		GameManipulator.onGameEnd = function () {
			UI.logger.log('Game HAS ended!', game);

			startGame();
		}
	});	
}
*/
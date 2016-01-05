var robot = require('robotjs');

// Cache screen size
var screenSize = robot.getScreenSize();

// Indexes
var X = 0;
var Y = 1;


// Create the "class" wrapper
var Scanner = {};


// Check if the given position is outside the Screen
Scanner.isOutOfBound = function (pos) {
  if ( pos[X] < 0 || pos[Y] < 0 ||
     pos[X] >= screenSize.width ||
     pos[Y] >= screenSize.height) {

    return true;
  }

  return false;
}


// Limits the x/y values of position to fit the screen
Scanner.makeInBounds = function (pos) {

  if (pos[X] < 0) {
    pos[X] = 0;
  }

  if (pos[X] >= screenSize.width) {
    pos[X] = screenSize.width - 1;
  }

  if (pos[Y] < 0) {
    pos[Y] = 0;
  }

  if (pos[Y] >= screenSize.height) {
    pos[Y] = screenSize.height - 1;
  }

  return pos;
}


//  Given start [X, Y], and a DELTA [dX, dY],
//  maps from "start", adding "delta" to position,
//  until "matchinColor" is found OR isOutOfBounds.
//
//  If iterations reach > iterLimit:
//    returns null;
//
//  if isOutOfBounds:
//    returns null
//
//  otherwise:
//    return that point
//
//  Example: (X direction)
//    scanUntil([0,0], [1, 0], "000000");
Scanner.scanUntil = function (start, delta, matchColor, inverted, iterLimit) {
  var color, current, iterations = 0;

  // (CLONE instead of using the real one)
  current = Scanner.makeInBounds([start[X], start[Y]]);

  if (delta[X] == 0 && delta[Y] == 0) {
    return null;
  }


  while (!Scanner.isOutOfBound(current)) {
    // Check current pixel
    color = robot.getPixelColor(current[X], current[Y]);

    if (!inverted && color.toString() == matchColor) {
      return current;
    }

    if (inverted && color.toString() != matchColor) {
      return current;
    }

    current[X] += delta[X];
    current[Y] += delta[Y];
    iterations++;

    if (iterations > iterLimit) {
      return null;
    }
  }

  return null;
};


// Export the module
module.exports = Scanner;

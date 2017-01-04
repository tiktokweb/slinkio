var express = require('express');
var app = express();
var counter = 0;
var DEFAULT_SPEED = 10;
var WIDTH = 1100;
var HEIGHT = 580;
var SNAKE_INIT_HP = 10;

//Static resources server
app.use(express.static(__dirname + '/main'));

var server = app.listen(8082, function () {
	var port = server.address().port;
	console.log('Server running at port %s', port);
});

var io = require('socket.io')(server);

function GameServer(){
	this.snakes = [];
	this.orbs = [];
	this.lastOrbId = 0;
	console.log("Creating GameServer");
	// populate all the orbs here
}

GameServer.prototype = {

	addSnake: function(snake){
		console.log("adding snake in index.js");
		this.snakes.push(snake);
	},

	addOrb: function(orb){
		this.orbs.push(orb);
	},

	removeSnake: function(snakeId){
		//Remove snake object
		this.snakes = this.snakes.filter( function(t){return t.id != snakeId} );
	},

	//Sync tank with new data received from a client
	syncSnake: function(newSnakeData){
		this.snakes.forEach( function(snake){
			if(snake.id == newSnakeData.id){
				snake.x = newSnakeData.x;
				snake.y = newSnakeData.y;
				snake.baseAngle = newSnakeData.baseAngle;
			}
		});
	},

	//The app has absolute control of the orbs and their placement
	syncOrbs: function(){
		var self = this;
		//Detect when orb is out of bounds
		this.orbs.forEach( function(orb){
			self.detectCollision(orb);

			// if(orb.x < 0 || orb.x > WIDTH
			// 	|| orb.y < 0 || orb.y > HEIGHT){
			// 	orb.out = true;
			// }else{
			// 	orb.fly();
			// }
		});
	},

	//Detect if orb collides with any tank
	detectCollision: function(orb){
		var self = this;

		this.snakes.forEach( function(snake){
			if(Math.abs(snake.x - orb.x) < 30
				&& Math.abs(snake.y - orb.y) < 30){
				//Hit tank
				self.boostSnake(snake);
				orb.out = true;
				orb.exploding = true;
			}
		});
	},

	boostSnake: function(snake){
		snake.hp += 2;
	},

	getData: function(){
		var gameData = {};
		gameData.snakes = this.snakes;
		gameData.orbs = this.orbs;

		return gameData;
	},

	cleanDeadSnakes: function(){
		this.snakes = this.snakes.filter(function(t){
			return t.hp > 0;
		});
	},

	cleanDeadOrbs: function(){
		this.orbs = this.orbs.filter(function(orb){
			return !orb.out;
		});
	},

	increaseLastOrbId: function(){
		this.lastOrbId ++;
		if(this.lastOrbId > 1000){
			this.lastOrbId = 0;
		}
	}

}

var game = new GameServer();

/* Connection events */

io.on('connection', function(client) {
	console.log('User connected');

	client.on('joinGame', function(snake){
		console.log(snake.id + ' joined the game');
		var initX = getRandomInt(40, 900);
		var initY = getRandomInt(40, 500);
		client.emit('addSnake', { id: snake.id, type: snake.type, isLocal: true, x: initX, y: initY, hp: SNAKE_INIT_HP });
		client.broadcast.emit('addSnake', { id: snake.id, type: snake.type, isLocal: false, x: initX, y: initY, hp: SNAKE_INIT_HP} );
		console.log("Calling addSnake on game object");
		game.addSnake({ id: snake.id, type: snake.type, hp: SNAKE_INIT_HP});
	});

	client.on('sync', function(data){
		//Receive data from clients
		if(data.snake != undefined){
			game.syncSnake(data.snake);
		}
		//update orb positions
		game.syncOrbs();
		//Broadcast data to clients
		client.emit('sync', game.getData());
		client.broadcast.emit('sync', game.getData());

		//I do the cleanup after sending data, so the clients know
		//when the tank dies and when the orbs explode
		game.cleanDeadSnakes();
		game.cleanDeadOrbs();
		counter ++;
	});

	// client.on('shoot', function(orb){
	// 	var orb = new Orb(orb.ownerId, orb.alpha, orb.x, orb.y );
	// 	game.addOrb(orb);
	// });

	client.on('leaveGame', function(snakeId){
		console.log(snakeId + ' has left the game');
		game.removeSnake(snakeId);
		client.broadcast.emit('removeSnake', snakeId);
	});

});

function Orb(ownerId, alpha, x, y){
	this.id = game.lastOrbId;
	game.increaseLastOrbId();
	this.x = x;
	this.y = y;
	this.out = false;
};

Orb.prototype = {

	// fly: function(){
	// 	//move to trayectory
	// 	var speedX = BALL_SPEED * Math.sin(this.alpha);
	// 	var speedY = -BALL_SPEED * Math.cos(this.alpha);
	// 	this.x += speedX;
	// 	this.y += speedY;
	// }

}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}

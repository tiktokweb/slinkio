var DEBUG = true;
var INTERVAL = 50;
var ROTATION_SPEED = 5;
var ARENA_MARGIN = 30;

function Game(arenaId, w, h, socket){
	this.snakes = []; //Snakes (other than the local snake)
	this.orbs = [];
	this.width = w;
	this.height = h;
	this.$arena = $(arenaId);
	this.$arena.css('width', w);
	this.$arena.css('height', h);
	this.socket = socket;

	var g = this;
	setInterval(function(){
		g.mainLoop();
	}, INTERVAL);
}

Game.prototype = {

	addSnake: function(id, type, isLocal, x, y, hp){
		var t = new Snake(id, type, this.$arena, this, isLocal, x, y, hp);
		if(isLocal){
			console.log("Adding Snake in snakes.js");
			this.localSnake = t;
		}else{
			console.log("WTF ADD SNAKE GLOBAL");
			this.snakes.push(t);
		}
	},

	removeSnake: function(snakeId){
		//Remove snake object
		this.snakes = this.snakes.filter( function(t){return t.id != snakeId} );
		//remove snake from dom
		$('#' + snakeId).remove();
		$('#info-' + snakeId).remove();
	},

	killSnake: function(snake){
		snake.dead = true;
		this.removeSnake(snake.id);
		//place explosion
		this.$arena.append('<img id="expl' + snake.id + '" class="explosion" src="./img/explosion.gif">');
		$('#expl' + snake.id).css('left', (snake.x - 50)  + 'px');
		$('#expl' + snake.id).css('top', (snake.y - 100)  + 'px');

		setTimeout(function(){
			$('#expl' + snake.id).remove();
		}, 1000);

	},

	addOrb: function(orb){
		this.orbs.push(orb);
	},

	mainLoop: function(){
		if(this.localSnake != undefined){
			this.sendData(); //send data to server about local snake
		}

		if(this.localSnake != undefined){
			//move local snake
			this.localSnake.move();
		}

	},

	sendData: function(){
		//Send local data to server
		var gameData = {};

		//Send snake data
		var t = {
			id: this.localSnake.id,
			x: this.localSnake.x,
			y: this.localSnake.y,
			baseAngle: this.localSnake.baseAngle,
		};
		gameData.snake = t;
		//Client game does not send any info about balls,
		//the server controls that part
		this.socket.emit('sync', gameData);
	},

	receiveData: function(serverData){
		var game = this;

		serverData.snakes.forEach( function(serverSnake){

			//Update local snake stats
			if(game.localSnake !== undefined && serverSnake.id == game.localSnake.id){
				game.localSnake.hp = serverSnake.hp;
				if(game.localSnake.hp <= 0){
					game.killSnake(game.localSnake);
				}
			}

			//Update foreign snakes
			var found = false;
			game.snakes.forEach( function(clientSnake){
				//update foreign snakes
				if(clientSnake.id == serverSnake.id){
					clientSnake.x = serverSnake.x;
					clientSnake.y = serverSnake.y;
					clientSnake.baseAngle = serverSnake.baseAngle;
					clientSnake.hp = serverSnake.hp;
					if(clientSnake.hp <= 0){
						game.killSnake(clientSnake);
					}
					clientSnake.refresh();
					found = true;
				}
			});
			if(!found &&
				(game.localSnake == undefined || serverSnake.id != game.localSnake.id)){
				//I need to create it
				game.addSnake(serverSnake.id, serverSnake.type, false, serverSnake.x, serverSnake.y, serverSnake.hp);
			}
		});

		//Render balls
		game.$arena.find('.cannon-ball').remove();

		serverData.orbs.forEach( function(serverOrb){
			var b = new Orb(serverOrb.id, serverOrb.ownerId, game.$arena, serverOrb.x, serverOrb.y);
			b.exploding = serverOrb.exploding;
			if(b.exploding){
				b.explode();
			}
		});
	}
}

function Orb(id, size, $arena, x, y){
	this.id = id;
	this.size = size;
	this.$arena = $arena;
	this.x = x;
	this.y = y;

	this.materialize();
}

Orb.prototype = {

	materialize: function(){
		this.$arena.append('<div id="' + this.id + '" class="cannon-ball" style="left:' + this.x + 'px"></div>');
		this.$body = $('#' + this.id);
		this.$body.css('left', this.x + 'px');
		this.$body.css('top', this.y + 'px');
	}

}

function Snake(id, type, $arena, game, isLocal, x, y, hp){
	this.id = id;
	this.type = type;
	this.speed = 5;
	this.$arena = $arena;
	this.w = 60;
	this.h = 80;
	this.baseAngle = getRandomInt(0, 360);
	//Make multiple of rotation amount
	this.baseAngle -= (this.baseAngle % ROTATION_SPEED);
	this.x = x;
	this.y = y;
	this.dir = [0, 0, 0, 0];
	this.game = game;
	this.isLocal = isLocal;
	this.hp = hp;
	this.dead = false;

	this.materialize();
}

Snake.prototype = {

	materialize: function(){
		this.$arena.append('<div id="' + this.id + '" class="snake snake' + this.type + '"></div>');
		this.$body = $('#' + this.id);
		this.$body.css('width', this.w);
		this.$body.css('height', this.h);

		this.$body.css('-webkit-transform', 'rotateZ(' + this.baseAngle + 'deg)');
		this.$body.css('-moz-transform', 'rotateZ(' + this.baseAngle + 'deg)');
		this.$body.css('-o-transform', 'rotateZ(' + this.baseAngle + 'deg)');
		this.$body.css('transform', 'rotateZ(' + this.baseAngle + 'deg)');

		this.$body.append('<div id="cannon-' + this.id + '" class="snake-cannon"></div>');
		this.$cannon = $('#cannon-' + this.id);

		this.$arena.append('<div id="info-' + this.id + '" class="info"></div>');
		this.$info = $('#info-' + this.id);
		this.$info.append('<div class="label">' + this.id + '</div>');
		this.$info.append('<div class="hp-bar"></div>');

		this.refresh();

		if(this.isLocal){
			this.setControls();
		}
	},

	isMoving: function(){
		if(this.dir[0] != 0 || this.dir[1] != 0){
			return true;
		}
		return false;
	},

	refresh: function(){
		this.$body.css('left', this.x - 30 + 'px');
		this.$body.css('top', this.y - 40 + 'px');
		this.$body.css('-webkit-transform', 'rotateZ(' + this.baseAngle + 'deg)');
		this.$body.css('-moz-transform', 'rotateZ(' + this.baseAngle + 'deg)');
		this.$body.css('-o-transform', 'rotateZ(' + this.baseAngle + 'deg)');
		this.$body.css('transform', 'rotateZ(' + this.baseAngle + 'deg)');

		this.$info.css('left', (this.x) + 'px');
		this.$info.css('top', (this.y) + 'px');
		if(this.isMoving()){
			this.$info.addClass('fade');
		}else{
			this.$info.removeClass('fade');
		}

		this.$info.find('.hp-bar').css('width', this.hp + 'px');
		this.$info.find('.hp-bar').css('background-color', getGreenToRed(this.hp));
	},

	setControls: function(){
		var t = this;

		/* Detect both keypress and keyup to allow multiple keys
		 and combined directions */
		$(document).keypress( function(e){
			var k = e.keyCode || e.which;
			switch(k){
				case 119: //W
					t.dir[1] = -1;
					break;
				case 100: //D
					t.dir[0] = 1;
					break;
				case 115: //S
					t.dir[1] = 1;
					break;
				case 97: //A
					t.dir[0] = -1;
					break;
			}

		}).keyup( function(e){
			var k = e.keyCode || e.which;
			switch(k){
				case 87: //W
					t.dir[1] = 0;
					break;
				case 68: //D
					t.dir[0] = 0;
					break;
				case 83: //S
					t.dir[1] = 0;
					break;
				case 65: //A
					t.dir[0] = 0;
					break;
			}
		}).mousemove( function(e){ //Detect mouse for aiming
			var mx = event.pageX - t.$arena.offset().left;
			var my = event.pageY - t.$arena.offset().top;
			//t.setCannonAngle(mx, my);
		}).click( function(){
			//t.shoot();
		});

	},

	move: function(){
		if(this.dead){
			return;
		}

		var moveX = this.speed * this.dir[0];
		var moveY = this.speed * this.dir[1]
		if(this.x + moveX > (0 + ARENA_MARGIN) && (this.x + moveX) < (this.$arena.width() - ARENA_MARGIN)){
			this.x += moveX;
		}
		if(this.y + moveY > (0 + ARENA_MARGIN) && (this.y + moveY) < (this.$arena.height() - ARENA_MARGIN)){
			this.y += moveY;
		}
		this.rotateBase();
		this.refresh();
	},

	/* Rotate base of snake to match movement direction */
	rotateBase: function(){
		if((this.dir[0] == 1 && this.dir[1] == 1)
			|| (this.dir[0] == -1 && this.dir[1] == -1)){ //diagonal "left"
			this.setDiagonalLeft();
		}else if((this.dir[0] == 1 && this.dir[1] == -1)
			|| (this.dir[0] == -1 && this.dir[1] == 1)){ //diagonal "right"
			this.setDiagonalRight();
		}else if(this.dir[1] == 1 || this.dir[1] == -1){ //vertical
			this.setVertical();
		}else if(this.dir[0] == 1 || this.dir[0] == -1){  //horizontal
			this.setHorizontal();
		}

	},

	/* Rotate base until it is vertical */
	setVertical: function(){
		var a = this.baseAngle;
		if(a != 0 && a != 180){
			if(a < 90 || (a > 180 && a < 270)){
				this.decreaseBaseRotation();
			}else{
				this.increaseBaseRotation();
			}
		}
	},

	/* Rotate base until it is horizontal */
	setHorizontal: function(){
		var a = this.baseAngle;
		if(a != 90 && a != 270){
			if(a < 90 || (a > 180 && a < 270)){
				this.increaseBaseRotation();
			}else{
				this.decreaseBaseRotation();
			}
		}
	},

	setDiagonalLeft: function(){
		var a = this.baseAngle;
		if(a != 135 && a != 315){
			if(a < 135 || (a > 225 && a < 315)){
				this.increaseBaseRotation();
			}else{
				this.decreaseBaseRotation();
			}
		}
	},

	setDiagonalRight: function(){
		var a = this.baseAngle;
		if(a != 45 && a != 225){
			if(a < 45 || (a > 135 && a < 225)){
				this.increaseBaseRotation();
			}else{
				this.decreaseBaseRotation();
			}
		}
	},

	increaseBaseRotation: function(){
		this.baseAngle += ROTATION_SPEED;
		if(this.baseAngle >= 360){
			this.baseAngle = 0;
		}
	},

	decreaseBaseRotation: function(){
		this.baseAngle -= ROTATION_SPEED;
		if(this.baseAngle < 0){
			this.baseAngle = 0;
		}
	}

}

function debug(msg){
	if(DEBUG){
		console.log(msg);
	}
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}

function getGreenToRed(percent){
	r = percent<50 ? 255 : Math.floor(255-(percent*2-100)*255/100);
	g = percent>50 ? 255 : Math.floor((percent*2)*255/100);
	return 'rgb('+r+','+g+',0)';
}

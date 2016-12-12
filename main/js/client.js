var WIDTH = 1100;
var HEIGHT = 580;
var socket = io.connect('http://localhost:8082');
var game = new Game('#arena', WIDTH, HEIGHT, socket);
var selectedSnake = 1;
var snakeName = '';

socket.on('addSnake', function(snake){
	game.addSnake(snake.id, snake.type, snake.isLocal, snake.x, snake.y);
});

socket.on('sync', function(gameServerData){
	game.receiveData(gameServerData);
});

socket.on('killSnake', function(snakeData){
	game.killSnake(snakeData);
});

socket.on('removeSnake', function(snakeId){
	game.removeSnake(snakeId);
});

$(document).ready( function(){

	$('#join').click( function(){
		snakeName = $('#snake-name').val();
		joinGame(snakeName, selectedSnake, socket);
	});

	$('#snake-name').keyup( function(e){
		snakeName = $('#snake-name').val();
		var k = e.keyCode || e.which;
		if(k == 13){
			joinGame(snakeName, selectedSnake, socket);
		}
	});

	$('ul.snake-selection li').click( function(){
		$('.snake-selection li').removeClass('selected')
		$(this).addClass('selected');
		selectedSnake = $(this).data('snake');
	});

});

$(window).on('beforeunload', function(){
	socket.emit('leaveGame', snakeName);
});

function joinGame(snakeName, snakeType, socket){
	if(snakeName != ''){
		$('#prompt').hide();
		socket.emit('joinGame', {id: snakeName, type: snakeType});
	}
}

// NOTE:
// IF YOU HAVE COME IN HERE I AM SORRY,
// FOR SERVERHELPERS IS DARK AND FULL OF TERRORS


var knex = require('knex')({
  client: 'postgresql',
  connection: {
    database: 'game-manager'
  }
});

exports.createGamesForTourney = function(req) {
  // games array will be returned by this function
  // get the tourneyId from the request body
  var tourneyId = req.body.tourneyId;

  // get the players list from the request body
  var players = req.body.players.slice();

  // This inner function is used to makeGames.
  function makeGames(tourneyId, players) {
    var games = [];

    // while there is more than one player in the tourneyPlayersList,
    while (players.length > 1) {

      // shift the first item off and hold it with our nextPlayer variable,
      var nextPlayer = players.shift();

      // then forEach player left in there, create a game with the nextPlayer
      // and push that game into the games array.
      players.forEach(function(player) {

        // This will be the object pushed into the games array.
        var game = {};

        // set the needed values for the game object
        game.player1_id = nextPlayer.id;
        game.player2_id = player.id;
        game.tournament_id = tourneyId;

        if (!games.length) {
          game.status = 'active';
        }
        // push into the games array
        games.push(game);
      });
    }
    return games;
  }
  // Call it!!
  var games = makeGames(tourneyId, players);
  // return the promise from the query
  return knex('games').insert(games);

};

exports.getTable = function(tourneyId) {

  return knex('games').where('tournament_id', tourneyId) //Currently throwing an error, need to fix
    .then(function(games) {
      var standingsObj = games.filter(game =>
        game.player1_score !== null
      ).reduce(function(standings, currGame) {
        // collect the player ids for this game
        var p1 = currGame.player1_id;
        var p2 = currGame.player2_id;

        // If player 1 and player 2 already have keys on the standings object, increment their games played.
          // Otherwise create the new stats object and count the first game.
        standings[p1] ? standings[p1].gp++ : standings[p1] = {gp: 1, win: 0, loss: 0, draw: 0, gd: 0, points: 0};
        standings[p2] ? standings[p2].gp++ : standings[p2] = {gp: 1, win: 0, loss: 0, draw: 0, gd: 0, points: 0};

        // Collect the scores for each player for this game.
        var p1Score = currGame.player1_score;
        var p2Score = currGame.player2_score;

        // Using Math.abs gives us a positive number always, we add this to the winner's Goal Differential,
          // and subtract it from the loser's GD
        var goalDiff = Math.abs(p1Score - p2Score);

        // This monstrosity of a nested ternary operation handles the accumulation of points and wins/losses/draws
          // First it checks if the game was a draw, if it was we have all the info we need to finish setting everything.
        p1Score === p2Score ? (
          standings[p1].draw++, standings[p2].draw++, standings[p1].points += 1, standings[p2].points += 1
          // If the game wasn't a draw, we go about finding a winner and setting the data we need.
        ) : p1Score > p2Score ? (
          standings[p1].win++, standings[p2].loss++, standings[p1].points += 3, standings[p1].gd += goalDiff, standings[p2].gd -= goalDiff
        ) : (
          standings[p2].win++, standings[p1].loss++, standings[p2].points += 3, standings[p1].gd -= goalDiff, standings[p2].gd += goalDiff
        );

        return standings;
      }, {});

      var playerIDs = Object.keys(standingsObj);

      // for (key in standingsObj) {
      //   idString += ('-' + key);
      // }

      // getAllPlayers function was made to accept a query string from a put request.
        // So we need to convert our array of player ids into a string with each
        // id separated by a '-' (dash).
      return exports.getAllPlayers(playerIDs)
        .then(playersArray => {
          var standingsArray = [];
          playersArray.forEach(player => {
            standingsObj[player.id].name = player.username;
            standingsObj[player.id].playerId = player.id;
            standingsArray.push(standingsObj[player.id]);
          });
          return standingsArray;
        })
        .catch(err => {
          throw err;
        });


    }).catch(function(err) {
      throw err;
    });
};

exports.setGameStatus = function(req, res) {

  // create the object to pass into the knex update
  var updateStatus = {};

  // The 'current' key on the body will be a boolean. True means set to active, false means set back to created.
  req.body.current ? updateStatus.status = 'active' : updateStatus.status = 'created';

  // Query the database for the correct game, and update it with the object we made above.
  knex('games').where('id', req.body.game.id).update(updateStatus).then(function(response) {
    res.status(201);
  }).catch(function(err) {
    res.status(500).send('err', err);
    throw err;
  });
};

exports.getAllPlayers = function(arrayOfIds) {
  if (arrayOfIds) {
    return knex('players').whereIn('id', arrayOfIds);
  } else {
    return knex('players').select();
  }
};

exports.setTournamentWinner = function(tourneyId, winnerId) {
  return knex('tournaments')
    .where('id', tourneyId)
    .update('winner_id', winnerId);
};

exports.updateGames = (req) => {
  //updateGames will use the game id to query the db for the correct game.
  var gameId = req.body.id;

  //This handles score validation.
  var player1Score = req.body.player1_score === '' ? null : req.body.player1_score;
  var player2Score = req.body.player2_score === '' ? null : req.body.player2_score;

  //Then set the status. This also is a validation thing, if there are no scores,
    // the game is definitely not finished! Keep it created
  var status = req.body.status;


  return knex('games').where('id', gameId)
    .update('player1_score', player1Score)
    .update('player2_score', player2Score)
    .update('status', status);
};

exports.makePlayer = function(req) {
  return knex('players').insert({
    username: req.body.username
  });
};

exports.makeTourney = function(tourneyName) {
  return knex('tournaments')
  .returning('id') //Needed for Postgres, when using sqlite3 not necessary
  .insert({
    tournament_name: tourneyName
  });
};

exports.organizedTourneys = (tournaments) => {
  // First we set up the structure for the returned object.
  let organized = {};
  // with two keys pointing to empty arrays.
  organized.finished = [];
  organized.onGoing = [];

  // then run over all the tournaments and place them in the proper array.
  tournaments.forEach(tournament => {
    tournament.winner_id === null ? organized.onGoing.push(tournament) : organized.finished.push(tournament);
  })

  // Then sort them for the most recent tournements to be first.
  organized.finished.sort((a, b) => b.id - a.id);
  organized.onGoing.sort((a, b) => b.id - a.id);

  return organized;
}

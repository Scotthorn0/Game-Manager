var express = require('express');
var Path = require('path');
var helpers = require('./serverHelpers.js');
var db = require('./db');

var routes = express.Router();

routes.use( require('body-parser').json() );

var knex = require('knex')({
  client: 'postgresql',
  connection: {
    database: 'game-manager'
  }
});

routes.use(express.static(Path.join(__dirname, 'public')));


// **************************************************

  // NOTE: Routes for players

routes.get('/api/player', function(req, res) {
  let playerIds = req.query.id;

  helpers.getAllPlayers(playerIds).then(players => {
    res.status(200).send(players);
  }).catch(err => {
    res.status(500).send(err);
  });
});


routes.post('/api/player', function(req, res) {
  //Prevent server from posting blank usernames with this if statement
  if (req.body.username === '') {
    res.status(404).send('Cannot Insert Empty String Into Database');
  } else {
    helpers.makePlayer(req).then(function(result) {
      res.status(201).send('Posted new user to the database');
    }).catch(function(err) {
      res.status(400).send('User already exists');
    });
  }
});


// **************************************************

  // NOTE: Routes for tournaments

routes.post('/api/tournaments', function(req, res) {
  var tourneyName = req.body.tournament_name;
  // To do validation on the name, and the amount of players in the tournament,
    // we need to check if the name is an empty string.
  if (tourneyName === '') {
    // If it is, send back a message to show the user the error.
    res.status(400).json({'message': 'IT\'S GOTTA HAVE A NAME!'});
  } else if (!req.body.enough) {
    // If we have passed the 'enough' boolean from the app as false,
      // then there are not enough players to make a tournament. Send back the message.
    res.status(400).json({'message': 'YOU CAN\'T JUST PLAY ALONE!'});
  } else {
    // Otherwise make the call for the query!
    helpers.makeTourney(tourneyName)
      .then(function(response) {
        res.status(201).send(response);
      }).catch(function(err) {
        res.status(500).send(err);
      });
  }
});

routes.put('/api/tournaments', function(req, res) {

  helpers.setTournamentWinner(req.body.id, req.body.winner_id)
    .then(function(response) {
      res.sendStatus(202);
    })
    .catch(function(err) {
      res.status(500).send(err);
    });

});

//NOTE: REFACTOR, the below will only fetch ONGOING tournaments
routes.get('/api/tournaments', function(req, res) {
  knex('tournaments')
  .orderBy('id', 'desc')
  .then(function(knexResponse) {
    // use our helper function here and organize all the tourneys
    let tourneys = helpers.organizedTourneys(knexResponse)

    res.send(tourneys);
  });
});


// **************************************************

  // NOTE: Routes for the games

routes.post('/api/games', function(req, res) {

  helpers.createGamesForTourney(req)
    .then(function(response) {
      res.status(201).send(response);
    })
    .catch(function(err) {
      res.status(500).send('Error inserting games into database');
    });
});


  // If a tournament_id is passed in as a query, just send the games in that tournament
  // If not, we send ALL the games in the DB
routes.get('/api/games', function(req, res) {
  // this will use the id from the query as the tournament id.
    // then fetch all games from the Database that have that tourneyId
  var tourneyId = req.query.tournament_id;
  // if the route was queried with a tournament_id, return the games of that tournament_id
  if (tourneyId) {
    // query the db here with the tourneyId
    knex('games').where('tournament_id', tourneyId).then(response => {
      res.status(200).send(response);
    }).catch(err => {
      res.status(500).send(err);
    });
  } else {
    // query the db here for all games
    knex.select().from('games').then(response => {
      res.status(200).send(response);
    }).catch(err => {
      res.status(500).send(err);
    });
  }
});

routes.put('/api/games', function(req, res) {

  helpers.updateGames(req)
    .then(function(response) {
      res.status(202).send('Successfully Updated Game Score');
    }).catch(function(err) {
      res.status(500).send('Failed to update scores in databse', err);
    });
});


// *******************************************

  // NOTE: Route for the table

routes.get('/api/table/', function(req, res) {
  helpers.getTable(Number(req.query.id))
  .then(function(response) {
    res.status(200).send(response);
  }).catch(function(err) {
    res.status(500).send(err);
  });
});
// *******************************************
//
// Static assets (html, etc.)
//
var assetFolder = Path.resolve(__dirname, '../server/public');
routes.use(express.static(assetFolder));


if (process.env.NODE_ENV !== 'test') {
  //
  // The Catch-all Route
  // This is for supporting browser history pushstate.
  // NOTE: Make sure this route is always LAST.
  //
  routes.get('/*', function(req, res) {
    res.sendFile( assetFolder + '/index.html' );
  });

  //
  // We're in development or production mode;
  // create and run a real server.
  //
  var app = express();

  // Parse incoming request bodies as JSON
  app.use( require('body-parser').json() );

  // Mount our main router
  app.use('/', routes);

  // Start the server!
  var port = process.env.PORT || 4000;
  app.listen(port);
  console.log('Listening on port', port);
} else {
  // We're in test mode; make this file importable instead.
  module.exports = routes;
}

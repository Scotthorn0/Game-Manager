var axios = require('axios');


exports.getFirstUnplayed = function(games) {
  // reduce the games array down to one object, that object will have up to three keys.
    // Created, active, or disabled. Each key points to an array of games.
  let organizedGames = games.reduce(function(organizedGames, currGame) {
    organizedGames[currGame.status] ? organizedGames[currGame.status].push(currGame) : organizedGames[currGame.status] = [currGame];
    return organizedGames;
  }, {});

  if (!organizedGames.created) {
    return null;
  }

  // Then we take the first game from the active list (if we have one), otherwise we take the first game from the Created list
  let firstUnplayed = organizedGames.active ? organizedGames.active[0] : organizedGames.created[0] || null;

  return firstUnplayed;
};

exports.getAllPlayers = function(state) {
    // axios rocks and makes nice promise based calls to the server for us.
  return axios.get('/api/player').then(function(playerData) {

    //Returns a list of players already in the tourney
    var tourneyPlayerIds = state.tourneyPlayersList.map((tourneyPlayer) => tourneyPlayer.id);

    //Returns a list of players not in the tourney from the db
    var notAdded = playerData.data.filter((player) => tourneyPlayerIds.indexOf(player.id) === -1);

    return notAdded.filter((player) => player.username !== '');

  }).catch(function(err) {
    // Handle any errors here.
    throw err
  });
};

// This function makes a call for all tournaments from the server and adds them to the state.
exports.getOngoingTournaments = function() {
  return axios.get('/api/tournaments')
    .then(function(tourneys) {
      // Here we take the existing tournaments and filter out the possible blank tournament since currently
        // one tournament can be created with a blank name.
      var existingTourneys = tourneys.data;
      return existingTourneys.filter(function(tourn) {
        return tourn.tournament_name !== '';
      });
    })
    .catch(function(err) {
      // Handle any errors here
      throw err
    });
};

exports.updateGameStatus = function(toBeActive, currentActive) {
  // toBeActive and currentActive point to games.
  // This function returns the promise.all of each axios PUT request to the server.
  if (currentActive.player1_score !== null && currentActive.player2_score !== null) {
    currentActive.status = 'disabled';
  }

  return Promise.all([
    // we update the new active game and the old active game.
    axios.put('/api/games', toBeActive),
    axios.put('/api/games', currentActive)
  ]);
};


exports.getGamesByTourneyId = function(tourneyId) {
  return axios.get('/api/games', {
    params: {
      tournament_id: tourneyId
    }
  }).then(function(response) {
    // Collect the games array into a variable, and pass that into the helper function.
    var games = response.data;

    // getFirstUnplayed goes through the list of games and finds the first one that is active,
      // if there is no active game, then it finds the next unplayed game.
    var nextGame = exports.getFirstUnplayed(games);

    // getFirstUnplayed returns null if there are no active or unplayed games.
    if (nextGame) {
      // So we make sure the status of that game is set to active if there is one.
      nextGame.status = 'active';
    }
    // then return in a promise an object holding the games, and the nextGame
    return {games: games, nextGame: nextGame};
  }).catch(err => {

    return err;
  });
};

exports.getTableForTourney = function(tourneyId) {
  return axios.get('/api/table', {
    params: {
      id: tourneyId
    }
  }).then(function(res) {
    var table = res.data.sort(function(prevPlayer, currentPlayer) {
      return prevPlayer.points === currentPlayer.points ? currentPlayer.gd - prevPlayer.gd : currentPlayer.points - prevPlayer.points;
    });
    return table;
  }).catch(function(err) {
    throw err;
  });
};

exports.filterToUniquePlayers = (playersList) => {
  var dictionary = {};

  var uniqueList = [];

  playersList.forEach(playaObj => {
    dictionary[playaObj.id] ? '' : (uniqueList.push(playaObj), dictionary[playaObj.id] = 'found');
  });

  return uniqueList;
};

exports.formatName = (name) => (
  name.split('').map((letter, index) => index === 0 ? letter.toUpperCase() : letter.toLowerCase() ).join('')
);

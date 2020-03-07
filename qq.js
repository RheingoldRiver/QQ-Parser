fetchAsync = async (url) => {
	let response = await fetch(url);
	let data = await response.json();
	return data;
}

getMatchIds = async (input) => {
	let url = config.url0 + input;
	let data = await fetchAsync(url);
	let arr = [];
	for (i in data.msg) {
		arr.push(data.msg[i].sMatchId);
	}
	return arr;
}

getLookupData = async () => {
	let w_data = await queryWiki();
	let disambigData = w_data[0];
	let teamnamesData = w_data[1];
	let itemDataWiki = w_data[2];
	let eventsData = w_data[3];
	let d_data = await queryDdragon(patch);
	let runeData = d_data[0];
	let championData = d_data[1];
	let summonerData = d_data[2];
	let itemData = d_data[3];
	let runeLookup = {};
	for (let t in runeData) {
		let tree = runeData[t];
		for (let s in tree.slots) {
			let slot = tree.slots[s];
			for (let r in slot.runes) {
				let rune = slot.runes[r];
				runeLookup[parseInt(rune.id)] = { tree : tree.key, name : rune.name };
			}
		}
	}
	let championLookup = {};
	for (let champ in championData.data) {
		let champdata = championData.data[champ];
		championLookup[parseInt(champdata.key)] = champdata.name;
	}
	let summonerLookup = {};
	for (let summoner in summonerData.data) {
		let summonerdata = summonerData.data[summoner];
		summonerLookup[parseInt(summonerdata.key)] = summonerdata.name;
	}
	let itemLookup = {};
	for (let key in itemData.data) {
		itemLookup[key] = itemData.data[key].name;
	}
	return {
		patch : patch,
		runes : runeLookup,
		champions : championLookup,
		summoners : summonerLookup,
		items : { d : itemLookup, w : itemDataWiki },
		disambigs : disambigData,
		teamnames : teamnamesData,
		events : eventsData
	}
}

queryWiki = async () => {
	let pages = [
		'Maintenance:LPL_Disambigs',
		'Maintenance:LPL_Teamnames',
		'Maintenance:LPL_Items',
		'Maintenance:LPL_Events'
	];
	let results = [];
	for (let page of pages) {
		results.push(new Promise((resolve, reject) => {
			resolve(getWikiDataTable(page));
		}));
	}
	return Promise.all(results);
}

getWikiData = async page => {
	let url = `https://lol.gamepedia.com/api.php?action=parse&page=${page}&format=json&prop=wikitext&origin=*`;
	let data = await fetchAsync(url);
	return data.parse.wikitext['*'].split(/\n*@@@@/)[0];
}

getWikiDataTable = async page => {
	let str = await getWikiData(page);
	let tbl = str.split('\n');
	let data = {}
	for (let line of tbl) {
		let line_tbl = line.split('|');
		data[line_tbl[0]] = line_tbl[1];
	}
	return data;
}

queryDdragon = async patch => {
	let urls = [
		`https://ddragon.leagueoflegends.com/cdn/${patch}.1/data/en_US/runesReforged.json`,
		`https://ddragon.leagueoflegends.com/cdn/${patch}.1/data/en_US/champion.json`,
		`https://ddragon.leagueoflegends.com/cdn/${patch}.1/data/en_US/summoner.json`,
		`https://ddragon.leagueoflegends.com/cdn/${patch}.1/data/en_US/item.json`
	];
	let results = [];
	for (let url of urls) {
		results.push(new Promise((resolve, reject) => {
			resolve(fetchAsync(url));
		}));
	}
	return Promise.all(results);
}

getGameData = async (games, keyToNameLookups) => {
	let ids = [];
	for (let game of games) {
		ids.push(new Promise((resolve, reject) => {
			resolve(processGame(game, keyToNameLookups));
		}));
	};
	return Promise.all(ids);
} 

processGame = async (gameId) => {
	let url1 = config.url1 + gameId;
	let gameData = await fetchAsync(url1);
	let areaId = gameData.msg.battleInfo.AreaId;
	let battleId = gameData.msg.battleInfo.BattleId;
	// console.log(gameId + ' area id ' + areaId);
	let url2 = config.url2 + `${battleId}&world_id=${areaId}`;
	// console.log(gameId + ' url2 ' + url2);
	let worldIdResponse = await fetchAsync(url2);
	console.log('parsing worldId');
	let worldIdData = {};
	try {
		worldIdData = JSON.parse(worldIdResponse.msg);
	}
	catch(err) {
		console.log('error parsing worldId json');
	}
	// console.log(gameId + ' worldIdData ');
	// console.log(worldIdData);
	var runeData;
	if (worldIdData.battle_count_ == 1) {
		let worldId = worldIdData.battle_list_[0].world_;
		// console.log(gameId + ' worldId');
		// console.log(worldId);
		let url3 = config.url3 + `${worldId}&room_id=${battleId}`;
		let runeDataFull = await fetchAsync(url3);
		console.log('parsing runeDataFull');
		let runeDataResponse = JSON.parse(runeDataFull.msg).hero_list_;
		runeData = parseRuneData(runeDataResponse);
	}
	let output = { game : gameData, runes : runeData, clans : worldIdData.battle_list_ };
	return output;
}

parseRuneData = data => {
	let output = {}
	for (let player of data) {
		output[parseInt(player.hero_id_)] = player;
	}
	return output;
}

dataToString = (gameFull, runeData, clans, keyToNameLookups) => {
	let players = [
		{ t : 'left', i: 0, arg : 'blue1' },
		{ t : 'left', i: 1, arg : 'blue2' },
		{ t : 'left', i: 2, arg : 'blue3' },
		{ t : 'left', i: 3, arg : 'blue4' },
		{ t : 'left', i: 4, arg : 'blue5' },
		{ t : 'right', i: 0, arg : 'red1' },
		{ t : 'right', i: 1, arg : 'red2' },
		{ t : 'right', i: 2, arg : 'red3' },
		{ t : 'right', i: 3, arg : 'red4' },
		{ t : 'right', i: 4, arg : 'red5' }
	];
	let teams = [ { t : 'left', arg : 'team1' }, { t : 'right', arg : 'team2' } ];
	let dataOrderPlayer = [ 'champion', 'name', 'link', 'kills', 'deaths', 'assists', 'gold', 'cs', 'visionscore', 'summonerspell1', 'summonerspell2', 'item1', 'item2', 'item3', 'item4', 'item5', 'item6', 'trinket', 'keystone', 'secondary', 'pentakills' ];
	let dataOrderTeam = [ '', 'ban1', 'ban2', 'ban3', 'ban4', 'ban5', 'g', 'k', 'd', 'b', 't', 'rh', 'i' ];
	let dataOrderGame = [ 'patch', 'winner', 'date', 'dst', 'KST', 'gamelength' ];
	let teamHash = { left : 1, right : 2 };
	let dataKeys = [ 'id',  ];
	let teamnames = getTeamnames(gameFull.msg, clans, keyToNameLookups.teamnames);
	let str = gameFull.msg.battleInfo.BattleData;
	// console.log('runeData');
	// console.log(runeData);
	console.log('parsing gameData from BattleData');
	let gameData = JSON.parse(str);
	let playerData = [];
	let teamkills = { left : 0, right : 0 };
	let teamgold = { left : 0, right : 0 };
	for (let i in players) {
		let player = players[i];
		let arg = player.arg;
		let t = player.t;
		let data = gameData[player.t].players[player.i];
		// console.log(data.name);
		teamkills[player.t] = teamkills[player.t] + parseInt(data.kill);
		teamgold[player.t] = teamgold[player.t] + parseInt(data.gold);
		let values = {
			champion : keyToNameLookups.champions[parseInt(data.hero)],
			name : getName(data.name, teamnames[t + '_lookup']),
			link : getLink(data.name, keyToNameLookups.disambigs),
			kills : data.kill,
			deaths : data.death,
			assists : data.assist,
			gold : data.gold,
			cs : data.lasthit,
			pentakills : data.pKills,
			summonerspell1 : keyToNameLookups.summoners[parseInt(data['skill-1'])],
			summonerspell2 : keyToNameLookups.summoners[parseInt(data['skill-2'])],
			item1 : getItem(data.equip['game-equip-1'], keyToNameLookups.items),
			item2 : getItem(data.equip['game-equip-2'], keyToNameLookups.items),
			item3 : getItem(data.equip['game-equip-3'], keyToNameLookups.items),
			item4 : getItem(data.equip['game-equip-4'], keyToNameLookups.items),
			item5 : getItem(data.equip['game-equip-5'], keyToNameLookups.items),
			item6 : getItem(data.equip['game-equip-6'], keyToNameLookups.items),
			trinket : getTrinket(data.equip['game-equip-7'], keyToNameLookups.items),
		}
		if (runeData && runeData[parseInt(data.hero)]) {
			let runeDataThis = runeData[parseInt(data.hero)];
			let keystone = runeDataThis.runes_info_.runes_list_[0].runes_id_;
			let secondary = runeDataThis.runes_info_.runes_list_[5].runes_id_;
			let keystoneData = keyToNameLookups.runes[parseInt(keystone)];
			let secondaryData = keyToNameLookups.runes[parseInt(secondary)];
			values.keystone = keystoneData ? keystoneData.name : keystone;
			values.secondary = secondaryData ? secondaryData.tree : secondary;
		}
		playerData.push(values);
	}
	let playerOutput = generatePlayerOutput(players, playerData, dataOrderPlayer);
	let teamData = [];
	for (let team of teams) {
		let t = team.t;
		let data = gameData[t];
		values = {
			k : teamkills[t],
			g : teamgold[t],
			t : data.tower,
			b : data['b-dragon'],
			d : data['s-dragon'],
			ban1 : keyToNameLookups.champions[parseInt(data['ban-hero-1'])],
			ban2 : keyToNameLookups.champions[parseInt(data['ban-hero-2'])],
			ban3 : keyToNameLookups.champions[parseInt(data['ban-hero-3'])],
			ban4 : keyToNameLookups.champions[parseInt(data['ban-hero-4'])],
			ban5 : keyToNameLookups.champions[parseInt(data['ban-hero-5'])],
			'' : teamnames[t]
		}
		teamData.push(values);
	}
	let teamOutput = generateTeamOutput(teams, teamData, dataOrderTeam, teamnames);
	let date = gameFull.msg.battleInfo.BattleDate;
	let time = gameFull.msg.battleInfo.BattleTime;
	let datetime = getDateTime(date, time);
	let gameValues = {
		winner : teamHash[gameData['game-win']],
		patch : keyToNameLookups.patch,
		gamelength : getGamelength(gameData['game-period']),
		date : datetime.date,
		KST : datetime.time,
		dst : datetime.dst
	}
	let gameOutput = generateGameOutput(gameValues, dataOrderGame);
	let output = [ gameOutput, teamOutput, playerOutput ];
	let response = {
		wikitext : output.join('\n'),
		team1 : teamData[0][''],
		team2 : teamData[1][''],
		winner : gameValues.winner,
		event : gameFull.msg.sMatchInfo.GameId
	}
	return response
}

getItem = (item, data) => {
	// w is wiki, d is ddragon
	let s = item.toString();
	if (data.w[s]) {
		return data.w[s];
	}
	return data.d[parseInt(item)];
}

getTrinket = (item, data) => {
	if (! item || item == '') return '';
	let parsed = data.d[parseInt(item)]
	if (! parsed) return '';
	return parsed.replace('(Trinket)','')
}

getName = (name, team) => {
	let replace = '^' + team.replace('.','');
	let re = new RegExp(replace);
	return name.replace(re, '');
}

getLink = (name, disambigs) => {
	if (disambigs[name]) return disambigs[name];
	return;
}

generatePlayerOutput = (players, data, order) => {
	let output = []
	for (let i in players) {
		let arg = players[i].arg;
		let outputThis = [];
		let dataThis = data[i];
		for (let key of order) {
			outputThis.push('|' + key + '=' + (dataThis[key] ? dataThis[key] : ''));
		}
		output.push(`|${arg}={{MatchRecapS8/Player` + outputThis.join(' ') + '}}');
	}
	return output.join('\n');
}

getTeamnames = (gameData, clanData, lookup) => {
	console.log(clanData);
	if (clanData) {
		console.log('from clans');
		let attemptedOutput = getTeamnamesFromClans(clanData, lookup);
		if (attemptedOutput.left && attemptedOutput.right) return attemptedOutput;
	}
	let str = gameData.sMatchInfo.bMatchName;
	let arr = str.split(' ');
	let name1 = lookup[arr[0]] ? lookup[arr[0]] : arr[0];
	let name2 = lookup[arr[2]] ? lookup[arr[2]] : arr[2];
	let blueId = gameData.sMatchInfo.BlueTeam;
	let teamA = gameData.sMatchInfo.TeamA;
	let teamB = gameData.sMatchInfo.TeamB;
	console.log('blue id:' + blueId);
	console.log('teamA:' + teamA);
	console.log('teamB:' + teamB);
	if (blueId == teamA) {
		return {
			left : name1,
			right : name2,
			left_lookup : arr[0],
			right_lookup : arr[2]
		};
	}
	else if (blueId == teamB) {
		return {
			left : name2,
			right : name1,
			left_lookup : arr[2],
			right_lookup : arr[0]
		};
	}
}

getTeamnamesFromClans = (clanData, lookup) => {
	let blueId = clanData[0].blue_clan_id_;
	let blue = clanData[0].blue_clan_name_;
	let redId = clanData[0].red_clan_id_;
	let red = clanData[0].red_clan_name_;
	let blueName = lookup[blue] ? lookup[blue] : blue;
	let redName = lookup[red] ? lookup[red] : red;
	console.log('blue id:' + blueId + ' ' + blueName + ' ' + blue);
	console.log('red id:' + redId + ' ' + redName + ' ' + red);
	return {
		left : blueName,
		right : redName,
		left_lookup : blue,
		right_lookup : red
	};
}

getGamelength = (str) => {
	if (! str) return;
	let num = parseInt(str);
	let min = Math.floor(num / 60);
	let sec = num % 60;
	if (sec < 10) {
		sec_str = sec.toString();
		sec = '0' + sec_str;
	}
	return min + ':' + sec;
}

generateTeamOutput = (teams, data, order, teamnames) => {
	let output = []
	for (let i in teams) {
		let outputThis = [];
		let arg = teams[i].arg;
		let dataThis = data[i];
		for (let key of order) {
			outputThis.push('|' + arg + key + '=' + (typeof(dataThis[key]) !== 'undefined' ? dataThis[key] : '' ));
		}
		output.push(outputThis.join(' '));
	}
	return output.join('\n');
}

getDateTime = (date, time) => {
	let datetime = { date : date };
	let tzCN = 'Asia/Chongqing';
	let tzKR = 'Asia/Seoul';
	let tzUS = 'America/Chicago';
	let tzEU = 'Europe/Paris';
	let timestamp = moment.tz(date + ' ' + time, tzCN);
	// console.log(timestamp.format());
	datetime.time = timestamp.clone().tz(tzKR).format('HH:mm:ss');
	// console.log(datetime.time);
	let cn = moment.tz(timestamp, 'hA', 'Asia/Chongqing');
	let kr = moment.tz(timestamp, 'hA', 'Asia/Seoul');
	// console.log(cn);
	// console.log(kr);
	let dstUS = moment.tz(timestamp, tzUS).isDST();
	let dstEU = moment.tz(timestamp, tzEU).isDST();
	// console.log('US ' + dstUS);
	// console.log('EU ' + dstEU);
	if (dstUS && dstEU) datetime.dst = 'yes';
	else if (dstUS && !dstEU) datetime.dst = 'spring';
	else datetime.dst = 'no';
	return datetime;
}

generateGameOutput = (data, order) => {
	let output = []
	for (let key of order) {
		output.push('|' + key + '=' + (data[key] ? data[key] : '' ));
	}
	return output.join(' ');
}

getEvent = (input, data, id) => {
	let $el = $(document.createElement('div')).addClass('tournament-info').attr('id','event-output');
	let button = document.getElementById('submit-button');
	if (id.toString() in data) {
		let event = data[id.toString()];
		$el.html('Code: ' + id + ', Tournament fetched: ' + event);
		$el.insertAfter(button);
		return event;
	}
	else if (input) {
		$el.html('Code: ' + id + ', Tournament provided: ' + input);
		$el.insertAfter(button);
		return input;
	}
	else {
		let text = 'No tournament found! Code is ' + id;
		$el.html(text)
		$el.insertAfter(button);
		alert(text);
		return;
	}
}

processSeriesTotals = (printedData, input, event) => {
	let output = [];
	let team1 = printedData[0].team1;
	let team2 = printedData[0].team2;
	output.push(`{{MatchRecapS8/Header|${team1}|${team2}}}`);
	let teamscores = {};
	teamscores[team1] = 0;
	teamscores[team2] = 0;
	for (let i in printedData) {
		let n = parseInt(i) + 1;
		team1 = printedData[i].team1;
		team2 = printedData[i].team2;
		let game = printedData[i];
		if (game.winner == 1) {
			teamscores[team1]++;
		}
		else if (game.winner == 2) {
			teamscores[team2]++;
		}
		let score1 = teamscores[game.team1];
		let score2 = teamscores[game.team2];
		let newline = '{{MatchRecapS8|gamename=Game ' + n + '|team1score=' + score1 + '|team2score=' + score2 + '|tournament=' + event;
		let lastline = '|vodlink=  |statslink=http://lol.qq.com/match/match_data.shtml?bmid=' + input;
		output.push(newline);
		output.push(game.wikitext);
		output.push(lastline);
		output.push('}}');
	}
	return output.join('\n');
}

getPatch = async () => {
	patch = await getWikiData('Maintenance:LPL_Patch');
	document.getElementById('current-patch').innerHTML = patch;
}
$(function() {
	getPatch();
	
	document.getElementById('submit-button').addEventListener('click', async (e) => {
		e.preventDefault();
		if (document.getElementById('parser-output')) {
			$(document.getElementById('parser-output')).remove();
		}
		if (document.getElementById('event-output')) {
			$(document.getElementById('event-output')).remove();
		}
		let input = $(document.getElementById('source-match')).val();
		let tournament = $(document.getElementById('source-tournament')).val();
		if (!input) {
			alert('Must provide an input');
			return;
		}
		if (! input.match(/^[0-9]*$/)) {
			alert('Invalid input');
			return;
		}
		let gameIDs = await getMatchIds(input);
		let keyToNameLookups = await getLookupData();
		let data = await getGameData(gameIDs, keyToNameLookups);
		let printedData = [];
		for (let game of data) {
			printedData.push(dataToString(game.game, game.runes, game.clans, keyToNameLookups));
		}
		let event = getEvent(tournament, keyToNameLookups.events, printedData[0].event);
		if (! event) {
			return;
		}
		let outputData = processSeriesTotals(printedData, input, event);
		let el = document.createElement('textarea');
		let form = document.getElementById('input-form');
		$(el).attr('id', 'parser-output');
		el.value = outputData;
		$(el).insertAfter(form);
		return;
	});
});
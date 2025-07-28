# braggart

**Purpose
- Keep track of tabletop game statistics among your friends.

**Features
- Profile
	- Login/persistent account
	- Change display name
	- Change password
	- Change profile picture
	- Display stats
	- Select primary and secondary colors
- Games
	- Large preset game library (big time suck here) - unless there's a way to scrape and process BGG's library
	- Add new games locally
	- Edit games locally
	- Delete games locally
	- Display personal game stats
	- For games in the universal library, display global stats (?? Do we want to do this? Or do we just want this for local groups? This would be a hard feature to add later.)
	- Set win conditions and weights for local games
	- Create a local copy of a game from the universal library
	- Change thumbnail picture for local games
	- Variants
- Matches
	- Create match
	- Add players
	- Randomly select first player
	- Assign order of play (optional)
	- Edit date of match
	- Edit match notes
	- Match is owned by a single player
	- Owner and only owner can edit scores
	- Add handicaps to players for the match
	- Add pictures from the session
- Groups
- Friendships
- Teams
- Notes
	- Mentions
- Trophies
- Stats
	- This is the primary feature of the app
	- Various statistics are collected from every match
	- Different statistical models can be applied to provide rankings within a group

?? NETWORK RANKINGS: Do we only want to compare within a group? Imagine that Tim and James are both in group A and both in group B. Both groups play Settlers of Catan. If Tim wants to know whether he's a better player than James, should it only be T>J wrt A or should there be an option to compare Tim and James simpliciter? What if Tim and James have never played each other, but they've both played Sandy...should we use their stats relative to Sandy to establish a ranking between Tim and James? Perhaps include a "Networked Ranking" toggle. How far out should the network extend? Certainly no more than seven degrees of separation. How would that even be determined?
- A **friends_of_friends** association for each player, perhaps
- Friends of the friends of the friends of the friends of the friends of the friends of the friends of the player -- this would be a huge query...any way to make it more efficient?
- We want friends_of_friends limited to those who have played Settlers of Catan against each other
	- Sa|b: a has played settlers of catan with b
	- fof = []
	- fof << x where Sx|tim
	- fof << x where Sx|y where y is any member of fof
	- FOR0: Tim
	- FOF1: All those who have played soc with Tim
	- FOF2: Anyone who has played soc with those in FOF1 who are not themselves in FOF1 nor FOF0
	- FOF3: Anyone who has played soc with those in FOF2 who are not themselves in FOF2 nor FOF1 nor FOF0
- Call these fof_soc
- We want the intersection of Tim's fof_soc and James' fof_soc
- better_than rankings or this_much_better_than rankings?

```mermaid
classDiagram
	class Players{
		+Uuid id
		+Uuid thumbnail_id
		+String username
		+String password
		+String display_name
		+String color_1
		+String color_2
		+String state
		+String email
		+favoriteGame() : games
	}
	class Games{
		+Uuid id
		+Uuid owner_id
		+String name
		+Boolean most_points_wins
		+Boolean team_based
		+Boolean cooperative
		+Int points_to_win
		+Bigint weight
		+Bigint difficulty
	}
	class Variants{
		+ Uuid id
		+ Uuid base_game_id
	}
	class Matches{
		+Uuid id
		+Uuid game_id
		+Uuid owner_id
		+Bigint weight
		+String state
		+Datetime date_played
		+winners() : players
	}
	class Notes{
		+Uuid id
		+Uuid match_id
		+Uuid game_id
		+Uuid owner_id
		+String message
		+String state
	}
	class Mentions{
		+Uuid id
		+Uuid note_id
		+Uuid player_id
	}
	class Friendships{
		+Uuid id
		+Uuid friender_id
		+Uuid friended_id
		+String state
	}
	class PlayerMatches{
		+Uuid id
		+Uuid player_id
		+Uuid match_id
		+Int score
		+Int place_in_order
	}
	class Teams{
		+Uuid id
		+Uuid thumbnail_id
		+String name
		+String color_1
		+Sting color_2
	}
	class PlayerTeams{
		+Uuid id
		+Uuid player_id
		+Uuid team_id
	}
	class TeamMatches{
		+Uuid id
		+Uuid match_id
		+Uuid team_id
	}
	class Thumbnails{
		+Uuid id
		+Uuid asset_id
	}
	class Assets{
		+Uuid id
		+Uuid player_id
		+Uuid thumbnail_id
		+String type
	}
	class MatchAssets{
		+Uuid id
		+Uuid asset_id
		+Uuid match_id
	}
	class Tournaments{
		+Uuid id
		+Uuid player_id
		+String name
		+winners() : players
	}
	class Trophies{
		+Uuid id
		+Uuid thumbnail_id
		+String name
		+String type
	}
	class FirstGameTrophy{
		+Uuid id
		+awarded(player) : boolean
	}
	class PlayerTrophies{
		+Uuid id
		+Uuid player_id
		+Uuid trophy_id
		+Int number_awarded
	}
	class Groups{
		+Uuid id
		+Uuid thumbnail_id
		+Uuid player_id
		+String color_1
		+String color_2
		+String name
		+String state
		+favoriteGame()
	}
	class PlayerGroups{
		+Uuid id
		+Uuid player_id
		+Uuid group_id
		+Uui thumbnail_id
		+String color_1
		+String color_2
		+String name
		+String state
	}
	class GameTrophies{
		+Uuid id
		+Uuid game_id
		+Uuid trophy_id
	}
	
	Players "1" <--> "*" PlayerMatches
	Players "1" <--> "*" Notes : owner
	Players "1" <--> "*" PlayerTeams
	Players "1" <--> "*" Friendships
	Players "1" <--> "*" Friendships
	Players "1" <--> "1" Thumbnails
	PlayerMatches "*" <--> "1" Matches
	PlayerTeams "*" <--> "1" Teams
	Teams "1" <--> "*" TeamMatches
	TeamMatches "*" <--> "1" Matches
	Games "1" <--> "*" Matches
	Games "*" <--> "1" Players : owner
	Games "1" <--> "1" Thumbnails
	Matches "1" <--> "*" Notes
	Matches "1" <--> "*" MatchAssets
	Notes "1" <--> "*" Mentions
	Mentions "*" <--> "1" Players : mentioned
	Thumbnails "1" <--> "1" Assets
	Assets "1" <--> "*" MatchAssets
	Notes "*" <--> "1" Games
	Games "1" <--|> "*" Variants
	Players "1" <--> "*" Assets : owner
	Tournaments "1" <--> "*" Matches
	Tournaments "*" <--> "1" Players : owner
	Players "1" <--> "*" PlayerTrophies
	Trophies "1" <--> "*" PlayerTrophies
	Players "1" <--> "*" Groups : owner
	Players "1" <--> "*" PlayerGroups
	Groups "1" <--> "*" PlayerGroups
	Trophies --|> FirstGameTrophy
	Trophies "1" <--> "1" Thumbnails
	Games "1" <--> "*" GameTrophies
	Trophies "1" <--> "*" GameTrophies
	Players "1" <--> "*" Matches : owner
```

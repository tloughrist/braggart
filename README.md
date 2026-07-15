# braggart

## Purpose
- Keep track of tabletop game statistics among your friends.

## Features
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

This diagram reflects the **as-built schema** in
`supabase/migrations/0001_initial_schema.sql`. Notes:

- Credentials (password, auth) live in Supabase's `auth.users`; `players` is the
  public profile, keyed 1:1 to the auth user.
- Images live in Supabase Storage; the single `assets` table (full image +
  optional `thumbnail_path`) replaces the old Thumbnails/Assets split.
- Variants are modeled as a game with a `parent_game_id` self-reference rather
  than a separate table.
- Lifecycle/soft-delete uses typed enums (`entity_status`, `match_status`,
  `friendship_status`, `membership_status`) instead of free-text `state`.

```mermaid
classDiagram
	class players{
		+uuid id  «auth.users»
		+citext username
		+text display_name
		+citext email
		+uuid avatar_asset_id
		+text color_1
		+text color_2
		+entity_status status
	}
	class assets{
		+uuid id
		+uuid owner_id
		+asset_kind kind
		+text storage_path
		+text thumbnail_path
	}
	class games{
		+uuid id
		+uuid owner_id  «null = library»
		+uuid parent_game_id  «variant»
		+text name
		+boolean most_points_wins
		+boolean team_based
		+boolean cooperative
		+int points_to_win
		+numeric weight
		+numeric difficulty
		+uuid image_asset_id
		+int bgg_id
		+entity_status status
	}
	class groups{
		+uuid id
		+uuid owner_id
		+text name
		+uuid image_asset_id
		+text color_1
		+text color_2
		+entity_status status
	}
	class player_groups{
		+uuid id
		+uuid player_id
		+uuid group_id
		+membership_role role
		+membership_status status
	}
	class teams{
		+uuid id
		+text name
		+uuid image_asset_id
		+text color_1
		+text color_2
		+entity_status status
	}
	class player_teams{
		+uuid id
		+uuid player_id
		+uuid team_id
	}
	class tournaments{
		+uuid id
		+uuid owner_id
		+uuid group_id
		+text name
		+entity_status status
	}
	class matches{
		+uuid id
		+uuid game_id
		+uuid owner_id
		+uuid group_id
		+uuid tournament_id
		+numeric weight
		+match_status status
		+timestamptz date_played
	}
	class player_matches{
		+uuid id
		+uuid match_id
		+uuid player_id
		+uuid team_id
		+int score
		+int handicap
		+int place_in_order
		+int finishing_place
		+boolean is_winner
	}
	class team_matches{
		+uuid id
		+uuid match_id
		+uuid team_id
		+int score
		+boolean is_winner
	}
	class match_assets{
		+uuid id
		+uuid match_id
		+uuid asset_id
	}
	class friendships{
		+uuid id
		+uuid friender_id
		+uuid friended_id
		+friendship_status status
	}
	class notes{
		+uuid id
		+uuid owner_id
		+uuid match_id
		+uuid game_id
		+text message
		+entity_status status
	}
	class mentions{
		+uuid id
		+uuid note_id
		+uuid player_id
	}
	class trophies{
		+uuid id
		+text name
		+trophy_kind kind
		+jsonb criteria
		+uuid image_asset_id
	}
	class player_trophies{
		+uuid id
		+uuid player_id
		+uuid trophy_id
		+int number_awarded
	}
	class game_trophies{
		+uuid id
		+uuid game_id
		+uuid trophy_id
	}

	players "1" --> "*" assets : owner
	players "1" --> "1" assets : avatar
	players "1" --> "*" games : owner
	games "1" --> "*" games : variants (parent_game_id)
	games "1" --> "1" assets : image
	players "1" --> "*" groups : owner
	groups "1" --> "1" assets : image
	players "1" --> "*" player_groups
	groups "1" --> "*" player_groups
	teams "1" --> "1" assets : image
	players "1" --> "*" player_teams
	teams "1" --> "*" player_teams
	players "1" --> "*" tournaments : owner
	groups "1" --> "*" tournaments
	games "1" --> "*" matches
	players "1" --> "*" matches : owner
	groups "1" --> "*" matches
	tournaments "1" --> "*" matches
	matches "1" --> "*" player_matches
	players "1" --> "*" player_matches
	teams "1" --> "*" player_matches
	matches "1" --> "*" team_matches
	teams "1" --> "*" team_matches
	matches "1" --> "*" match_assets
	assets "1" --> "*" match_assets
	players "1" --> "*" friendships : friender
	players "1" --> "*" friendships : friended
	players "1" --> "*" notes : owner
	matches "1" --> "*" notes
	games "1" --> "*" notes
	notes "1" --> "*" mentions
	players "1" --> "*" mentions : mentioned
	trophies "1" --> "1" assets : image
	players "1" --> "*" player_trophies
	trophies "1" --> "*" player_trophies
	games "1" --> "*" game_trophies
	trophies "1" --> "*" game_trophies
```

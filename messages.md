# This is a list of messages you can send to server and receive from it.
## Sended messages:
Change the name of player:
<pre>
{
  id: number,
  name: string,
  type: "SetName"
}
</pre>
If the name is already used by other player, the server will append a number to it.

Tell the server that player is ready:
<pre>
{
  id: number,
  gametype: string, // A type of your session. In every game you can use multiple types of sessions. Player will play with other players having the same type of the game.
  plnumb: number, // "plnumb" - a number of players in the game.
  plinteam: number, // "plinteam" - a number of players in team.
  team: number, // Team - number of players in your team.
  type: "Ready"
}
</pre>

Tell the server that player is not ready:
<pre>
{
  id: number,
  type: "NReady"
}
</pre>

This server supports a teams system. To invite a player to your team, send this message:
<pre>
{
  id: number,
  name: string, // Name of invitated client.
  invname: string, // Name of inviting client.
  type: "Invite"
}
</pre>

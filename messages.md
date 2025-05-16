# This is a list of messages you can send to server and receive from it.
## Sended messages:
The first message sent by player - password:
<pre>
{
  id: number || undefined, // You haven't to sent player's id in the message with password.
  passw: string, // The password.
  type: "Password"
}
</pre>
Change the name of player (only if player is not ready and is not in the game):
<pre>
{
  id: number,
  name: string,
  type: "SetName"
}
</pre>
If the name is already used by other player, the server will append a number to it. If the player is in team, you must send this name to his teammates.

The message with player's action (send it only if the player is in the game):
<pre>
{
  id: number,
  name: string, // Player's name.
  data: any, // Player's action.
  type: "Action"
}
</pre>

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

This server supports a team system. To invite a player to your team, send this message (you can send it only if player is not ready and is not in the game):
<pre>
{
  id: number,
  name: string, // Name of invitated client.
  invname: string, // Name of inviting client.
  type: "Invite"
}
</pre>

If player accepts invitation, send this message (you can send it only if player is not ready and is not in the game):
<pre>
{
  id: number,
  name: string, // Name of invitated client.
  invname: string, // Name of inviting client.
  type: "AcceptInv"
}
</pre>

If player accepts invitation, send this message (you can send it only if player is not in the game. It is recommended to not send it if player is ready):
<pre>
{
  id: number,
  name: string, // Name of invitated client.
  invname: string, // Name of inviting client.
  type: "DeclineInv"
}
</pre>

If player wants to leave his team, send this message:
<pre>
{
  id: number,
  name: string, // Player's name.
  type: "LeaveTeam"
}
</pre>

If player wants to leave the game, send this message:
<pre>
{
  id: number,
  name: string, // Player's name.
  gid: string, // gid - Game ID.
  type: "LeaveGame"
}
</pre>

To send a message to other player, use this:
<pre>
{
  id: number,
  name: string, // Name of receiver.
  data: any, // Data to send.
  type: "Send"
}
</pre>

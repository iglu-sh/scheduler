import {createClient} from "redis"
const client = createClient({
    url: "redis://localhost:6379",
    password: "verysecret",
    username: "default"
})

client.on("error", (err) => console.log('Redis Client Error', err));
await client.connect()
await client.publish('queue', 'new')
await client.lPush('queue', "1")
//await client.lPush('queue', "1");
/*
await client.json.arrAppend('queue', '.test', {
    name: 'test2',
    value: 123
})
const rPopResult = await client.rPop('queue');
 */
//console.log('RPop Result:', rPopResult);
await client.destroy()
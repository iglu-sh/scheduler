import { createClient } from "redis";

const client = createClient({
    url: "redis://localhost:6379",
    password: "verysecret",
    username: "default"
});
const editor = createClient({
    url: "redis://localhost:6379",
    password: "verysecret",
    username: "default"
});

client.on("error", (err) => console.log("Redis Client Error", err));
editor.on("error", (err) => console.log("Redis Editor Client Error", err));
editor.on('connect', async () => {
    // Log all of the messages in the queue
    const queue = await editor.lRange("queue", 0, -1);
    console.log("Current queue contents:", queue);
    await editor.del("queue")
    console.log("Redis Editor Client connected");
})
client.on('connect', ()=>{
    console.log("Redis Client connected");
})
await client.connect();
await editor.connect()
client.subscribe("queue", async (message) => {
    console.log("Received message:", message);

    // Pop an item from the queue
    //const poppedMessage = await editor.rPop("queue");
    /*
    *
    if (poppedMessage) {
        console.log("Popped message:", poppedMessage);
    } else {
        console.log("No message to pop");
    }
    * */
});

// Keep the process running
process.on("SIGINT", async () => {
    await client.destroy();
    process.exit();
});
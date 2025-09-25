import type {BuildChannelMessage, BuildQueueMessage} from "@iglu-sh/types/controller";
import Logger from "@iglu-sh/logger";
import type {RedisClientType} from "redis";

export default async function processMessage(message: BuildChannelMessage, node_id:string, editor:RedisClientType): Promise<void> {
    // We can immediately ignore messages sent by ourselves OR messages not intended for us OR messages that have the type of claim (not handled by nodes)
    if(
        message.type === "build" ||
        message.sender === node_id ||
        (message.target !== null && message.target !== node_id)
    ) {
        Logger.debug(`Ignoring message from ${message.sender} to ${message.target} of type ${message.type} as it is not relevant to this node (${node_id})`)
        return
    }

    // Determine the type of message and process accordingly
    if(message.type === "queue"){
        // If the type is queue, we either have a new build or a cancelled build
        if((message.data as BuildQueueMessage).type === "cancel"){
            // Cancelled build - Publish a cancelled message to the build channel
        }
        if((message.data as BuildQueueMessage).type === "add"){
            // New build - Add the build to the queue in Redis
        }
    }
    if(message.type === "claim"){

    }
}
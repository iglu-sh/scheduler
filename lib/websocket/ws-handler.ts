// Listens to a websocket on the specified port and ip address
import type {combinedBuilder} from "@iglu-sh/types/core/db";
import type {wsMsg} from "@iglu-sh/types/builder/websocket.ts"
import Logger from "@iglu-sh/logger";

export function wsHandler(ip:string, port:string, builderConfig:combinedBuilder){
    Logger.debug(`Sending build config ${builderConfig.builder.id} to ws://${ip}:${port}/api/v1/build`);
    const ws = new WebSocket(`ws://${ip}:${port}/api/v1/build`);
    ws.onerror = (event) => {
        // TODO: see if we may need to kill the container here
        Logger.error(`Error in Websocket Connection for builder ${builderConfig.builder.id}: ${event}`);
    }
    ws.onopen = (event) => {
        Logger.debug(`Websocket Connection opened for builder ${builderConfig.builder.id}`);
        ws.send(JSON.stringify({
            type: "build_config",
            data: builderConfig
        }));
        Logger.info(`Build config ${builderConfig.builder.id} sent to builder at ws://${ip}:${port}/api/v1/build`);
    }

    ws.onmessage = (event) => {
        const message:wsMsg = JSON.parse(event.data);
        Logger.debug(`Received data from ws: ${event.data}`);

        // These are exit codes, so we need to finish the job in the database
        if(message.jobStatus === "failed" || message.jobStatus === "success"){
            // TODO: Close build
        }

        // Everything else means that we just log the message for now
    }

    ws.onclose = (event) => {
        Logger.info(`Websocket Connection closed for builder ${builderConfig.builder.id} with code ${event.code}`);
    }
}
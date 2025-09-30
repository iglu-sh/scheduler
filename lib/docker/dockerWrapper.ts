import Docker from "dockerode";
import Logger from "@iglu-sh/logger";

export default class DockerWrapper{
    private static DockerClient:Docker;
    constructor(DOCKER:Docker) {
        DockerWrapper.DockerClient = DOCKER;
    }
    static getClient():Docker{
        return DockerWrapper.DockerClient
    }

    // Starts a builder with the given id
    static startBuilder(id:string, builderConfigID:number, jobID:string, release:string, log_level:string){
        DockerWrapper.DockerClient.run(`ghcr.io/iglu-sh/iglu-builder:${release}`, [], [], {Tty: false, name: id, HostConfig:{NetworkMode:'iglu-nw'}, Env: [`LOG_LEVEL=${log_level}`]}, async (err)=>{
            if(err){
                Logger.error(`Error starting Docker container for builder config ID ${builderConfigID} (jobID: ${jobID}): ${err.message}`);

                throw new Error(`Error starting Docker container for builder config ID ${builderConfigID}: ${err.message}`);
            }
        })
    }
}
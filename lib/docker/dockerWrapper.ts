import Docker from "dockerode";
import Logger from "@iglu-sh/logger";

export default class DockerWrapper{
    private static DockerClient:Docker;
    constructor(DOCKER:Docker) {
        Logger.info(`Setting Docker Client`)
        DockerWrapper.DockerClient = DOCKER;
    }
    static getClient():Docker{
        return DockerWrapper.DockerClient
    }
    static async setup(){
        Logger.debug(`Setting Docker Client`)
        Logger.debug('Creating Docker Network')
        const info = await DockerWrapper.DockerClient.listNetworks()
        if(info.filter((nw)=>{return nw.Name === "iglu-nw"}).length === 0) {
            Logger.info('Creating Docker network "iglu-nw"');
            await DockerWrapper.DockerClient.createNetwork({
                Name: 'iglu-nw',
                CheckDuplicate: true,
                Driver: 'bridge',
            }).catch((error) => {
                Logger.error(`Failed to create Docker network "iglu-nw": ${error.message}`);
            });
        }
        else{
            Logger.debug('Docker Network exists, not creating')
        }
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
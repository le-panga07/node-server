import {placementRepo,providerRepo, providersConfig} from '../config/ConfigBuilder';
import AdapterResolver from '../resolver/AdapterResolver';
import {Placement} from '../config/models/Placement';
import { Deferred, Ajax } from '../services/Ajax';
import { ProviderConfig } from '../config/Type';
import AuctionManager from '../manager/AuctionManager';
import Logger from '../manager/LogManager';


export default class CoreModule{

    private static _adapterResolver:AdapterResolver;
    private static adapterMap;

    constructor(){
        CoreModule._adapterResolver=new AdapterResolver();
        CoreModule.adapterMap={};
    }

    public init(){
        
        this.makeRequests();
        this.fireRequests().then((providerResponses)=>{

            this.logProviderResponses(providerResponses);
            let auctionResult = new AuctionManager().conductAuction(providerResponses);
            this.renderAds(auctionResult);
         },err=>{
            err.send('OK error');
         });
    }

    public makeRequests() {
        placementRepo.each(this.makeBidRequestForPlacement);
    }
 
    private makeBidRequestForPlacement(placement:Placement,index:number){

        placement.providers.each((provider, index)=> {
        
            let providerConfig:ProviderConfig = providerRepo.find(provider.id);
            let adapter = CoreModule._adapterResolver.getAdapterInstance(providerConfig.entrypoint);

            CoreModule.adapterMap[providerConfig.entrypoint] = CoreModule.adapterMap[providerConfig.entrypoint] || {};
            CoreModule.adapterMap[providerConfig.entrypoint] = adapter;
            
            adapter.setRequest(placement,providerConfig);

        });
    }

    private fireRequests(){

        let defer= new Deferred();
        let promises=[];

        Object.keys(CoreModule.adapterMap).forEach((adapterName)=>{
            promises.push(CoreModule.adapterMap[adapterName].fireRequest());
        });

        Promise.all(promises).then((providerBidResponses)=>{
            providerBidResponses = [].concat.apply([], providerBidResponses);
            defer.resolve(providerBidResponses);
        });
        return defer.promise;
    } 



    private renderAds(auctionResult){

        let auctionWinner = [];

        Object.keys(auctionResult).forEach((placementid,placementindex:number)=>{
        Object.keys(auctionResult[placementid]).forEach((sizeInf,sizeindex)=>{
            if(auctionResult[placementid][sizeInf].length>0){
                let iframe = document.getElementById('iframe_'+(placementindex+1));
                var iWindow = (<HTMLIFrameElement> iframe).contentWindow;
                let doc= iWindow.document;
                doc.open();
                doc.write(auctionResult[placementid][sizeInf][0].adcode);
                doc.close();

                auctionWinner.push(auctionResult[placementid][sizeInf][0]);
            }
            })
        });

        Logger.log(auctionWinner,3);
    }
 
    private logProviderResponses(providerResponses){
        let requestPayload={};
    
        providerResponses.forEach((providerResponseAdslotMap)=>{
    
        Object.keys(providerResponseAdslotMap).forEach((adSlotConfig)=>{
    
            let providerId= providerResponseAdslotMap[adSlotConfig].id;
            requestPayload[providerResponseAdslotMap[adSlotConfig].id] =requestPayload[providerId] || {};
            requestPayload[providerResponseAdslotMap[adSlotConfig].id][adSlotConfig]=requestPayload[providerResponseAdslotMap[adSlotConfig].id][adSlotConfig] || {};
            requestPayload[providerResponseAdslotMap[adSlotConfig].id][adSlotConfig]= providerResponseAdslotMap[adSlotConfig];
    
            });
        })
        Logger.log(requestPayload,1);
    }
}
/* eslint-disable @typescript-eslint/explicit-function-return-type */
// @flow
import { API3 } from "./api"
import Restrictor from "./restrictor"

function timeout(time: number) {
    return new Promise(resolve => setTimeout(resolve, time))
}

declare var NodeFilter: any

export class NodeReplacer {
    private _api: API3
    private _idRegex: RegExp = /[di]\d{6}|c\d{7}/gi
    private _restrictor: Restrictor = new Restrictor

    public constructor(api: API3) {
        this._api = api
    }


    public async watch(element: Element) {
        await this.replace(element)
        const observer = new MutationObserver(this._getChangeHandler())
        observer.observe(element, {
            childList: true,
            characterData: true,
            subtree: true
        })
        return this
    }

    public _getChangeHandler() {
        return (mutations: MutationRecord[], _observer: MutationObserver) => {
            for(const { target } of mutations) {
                this.replace(target)
            }
        }
    }

    public async replace(element: Node) {
        const walker = document.createTreeWalker(element)
        const pending = []
        let x = 0
        while(walker.nextNode()) {
            if(++x === 500) {
                x = 0
                await timeout(0)
            }
            const { currentNode } = walker
            pending.push(this._replaceNode(currentNode))
        }
        
        if (element instanceof Element){
            // replace user id in tooltips
            const list: HTMLCollectionOf<HTMLButtonElement> = element.getElementsByTagName("button")
            for (var i = 0; i < list.length; i++){
                const attribute = list[i].getAttributeNode("aria-label")       
                if(attribute) {
                    pending.push(this._replaceAttribute(attribute))
                }     
            }
        }        

        await Promise.all(pending)
    }

    public async _replaceNode(node: Node) {
        if(!node.nodeValue) {
            return
        }
        
        const ids = node.nodeValue.match(this._idRegex) || []
        if(ids.length <= 0 || !this._restrictor.check(node.parentElement)) {
            return
        }
        const pending = []
        for(const id of ids) {
            pending.push(node.nodeValue = await this._replaceId(id, node.nodeValue))
        }
        await Promise.all(pending)
    }

    public async _replaceAttribute(attribute: Attr) {
        if(!attribute.value) {
            return
        }
        
        const ids = attribute.value.match(this._idRegex) || []
        if(ids.length <= 0) {
            return
        }
        const pending = []
        for(const id of ids) {
            pending.push(attribute.value = await this._replaceId(id, attribute.value))
        }
        await Promise.all(pending)
    }

    public async _replaceId(id: string, value: string): Promise<string> {
        const user = await this._api.getUser(id, window.location.hostname)
        if(!user) {
            return value
        }
        let userName = user.getName()
        if(userName && userName != "") {
            return value.replace(id, userName)
        }
        return value
    }
}


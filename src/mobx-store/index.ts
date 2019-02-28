import { observable, action, computed } from 'mobx';
import { v4 as uuid } from 'uuid';
import { generateMnemonic } from 'bip39';

type Overwrite<T1, T2> = {
    [P in Exclude<keyof T1, keyof T2>]: T1[P]
} & T2;

class SubStore {
    constructor(public rootStore: RootStore) {
    }
}

interface IAccount {
    label: string
    seed: string
    default: boolean
}

export class RootStore {
    private readonly VERSION = '0.1';

    public accountsStore: AccountsStore;
    public tabsStore: TabsStore;
    public filesStore: FilesStore;
    public settingsStore: SettingsStore;

    constructor(initState: any = {}) {
        if (initState.VERSION !== this.VERSION) {
            // Todo: add migration loaders instead of error reporting
            console.error(`Store version mismatch!\nLocalStorage: ${initState.VERSION} - App: ${this.VERSION}
             Please clear localStorage if app is not working`);
        }
        this.accountsStore = new AccountsStore(this, initState.accountsStore);
        this.tabsStore = new TabsStore(this, initState.tabsStore);
        this.filesStore = new FilesStore(this, initState.filesStore);
        this.settingsStore = new SettingsStore(this, initState.settingsStore);
    }

    // public serialize = createTransformer(() => ({
    //     VERSION: this.VERSION,
    //     accountsStore: this.accountsStore.accounts,
    //     tabsStore: this.tabsStore.tabs,
    //     filesStore: this.filesStore.files,
    //     settingsStore: this.settingsStore.nodes
    // }));
}

export class AccountsStore extends SubStore {
    @observable accounts: IAccount[];

    constructor(rootStore: RootStore, initState: any) {
        super(rootStore);
        if (initState == null) {
            this.accounts = [{
                seed: generateMnemonic(),
                label: 'Account 1',
                default: true
            }];
        } else {
            this.accounts = initState.accounts;
        }
    }

    @computed
    get defaultAccount() {
        return this.accounts.find(acc => acc.default);
    }

    @computed
    get defaultAccountIndex() {
        return this.accounts.findIndex(acc => acc.default);
    }

    @action
    addAccount(account: IAccount) {
        this.accounts.push(account);
    }

    @action
    setDefaultAccount(i: number) {
        this.accounts.forEach((acc, index) => acc.default = index === i);
    }

    @action
    deleteAccount(i: number) {
        this.accounts.splice(i, 1);
    }

    @action
    setAccountLabel(i: number, label: string) {
        this.accounts[i].label = label;
    }

    @action
    setAccountSeed(i: number, seed: string) {
        this.accounts[i].seed = seed;
    }

}

export enum TAB_TYPE {
    EDITOR,
    WELCOME
}

type TTab = IEditorTab | IWelcomeTab;

interface ITab {
    type: TAB_TYPE
    active: boolean
}

interface IEditorTab extends ITab {
    type: TAB_TYPE.EDITOR,
    fileId: string
}

interface IWelcomeTab extends ITab {
    type: TAB_TYPE.WELCOME
}

export class TabsStore extends SubStore {
    @observable tabs: TTab[];

    constructor(rootStore: RootStore, initState: any) {
        super(rootStore);
        if (initState == null) {
            this.tabs = [];
        } else {
            this.tabs = initState.tabs;
        }
    }

    @computed
    get activeTab() {
        return this.tabs.find(tab => tab.active);
    }

    @computed
    get activeTabIndex() {
        return this.tabs.findIndex(tab => tab.active);
    }

    @action
    addTab(tab: TTab) {
        this.tabs.push(tab);
        this.selectTab(this.tabs.length - 1);
    }

    @action
    selectTab(i: number) {
        this.tabs.forEach((tab, index) => tab.active = index === i);
    }

    @action
    closeTab(i: number) {
        if (this.tabs[i].active) {
            const neighborTab = this.tabs[i - 1] && this.tabs[i + 1];
            if (neighborTab) neighborTab.active = true;
        }
        this.tabs.splice(i, 1);
    }

    @action
    openFile(fileId: string) {
        this.addTab({type: TAB_TYPE.EDITOR, fileId, active: true});
    }
}

export enum FILE_TYPE {
    ASSET_SCRIPT = 'assetScript',
    ACCOUNT_SCRIPT = 'accountScript',
    TEST = 'test'
}

export interface IFile {
    id: string
    type: FILE_TYPE
    name: string
    content: string
}

export class FilesStore extends SubStore {
    @observable files: IFile[] = [];

    constructor(rootStore: RootStore, initState: any) {
        super(rootStore);
        if (initState == null) {
            this.files = [];
        } else {
            this.files = initState.files;
        }
    }

    @computed
    get currentFile() {
        const activeTab = this.rootStore.tabsStore.activeTab;
        if (activeTab && activeTab.type === TAB_TYPE.EDITOR) {
            return this.files.find(file => file.id === activeTab.fileId);
        } else return;
    }

    private generateFilename(type: FILE_TYPE) {
        let maxIndex = Math.max(...this.files.filter(file => file.type === type).map(n => n.name)
                .filter(l => l.startsWith(type.toString()))
                .map(x => parseInt(x.replace(type + '_', '')) || 0),
            0
        );
        return type + '_' + (maxIndex + 1);
    }

    fileById(id: string) {
        return this.files.find(file => file.id === id);
    }

    @action
    createFile(file: Overwrite<IFile, { id?: string, name?: string }>) {
        const newFile = {
            id: uuid(),
            name: this.generateFilename(file.type),
            ...file
        };
        this.files.push(newFile);
        return newFile;
    }

    @action
    deleteFile(id: string) {
        const i = this.files.findIndex(file => file.id === id);
        if (i > -1) this.files.splice(i, 1);

        // if deleted file was opened in active tab close tab
        const tabsStore = this.rootStore.tabsStore;
        const activeTab = tabsStore.activeTab;
        if (activeTab && activeTab.type === TAB_TYPE.EDITOR && activeTab.fileId === id) {
            tabsStore.closeTab(tabsStore.activeTabIndex);
        }
    }

    @action
    changeFileContent(id: string, newContent: string) {
        const file = this.fileById(id);
        if (file != null) file.content = newContent;
    }

    @action
    renameFile(id: string, newName: string) {
        const file = this.fileById(id);
        if (file != null) file.name = newName;
    }
}

interface INode {
    chainId: string
    url: string
    default: boolean
}

export class SettingsStore extends SubStore {
    @observable nodes: INode[];

    constructor(rootStore: RootStore, initState: any) {
        super(rootStore);
        if (initState == null) {
            this.nodes = [
                {chainId: 'T', url: 'https://testnodes.wavesnodes.com/', default: true},
                {chainId: 'W', url: 'https://nodes.wavesplatform.com/', default: false}
            ];
        } else {
            this.nodes = initState.nodes;
        }
    }

    @computed
    get defaultNode() {
        return this.nodes.find(node => node.default);
    }

    @computed
    get consoleEnv() {
        const defNode = this.defaultNode;
        if (!defNode) return {};
        return {
            API_BASE: defNode.url,
            CHAIN_ID: defNode.chainId
        };
    }

    @action
    addNode(node: INode) {
        this.nodes.push(node);
    }

    @action
    deleteNode(i: number) {
        this.nodes.splice(i, 1);
    }

    @action
    setDefaultNode(i: number) {
        this.nodes.forEach((node, index) => node.default = index === i);
    }
}

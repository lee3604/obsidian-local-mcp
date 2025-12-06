
export class MockFile {
    path: string;
    basename: string;
    content: string;
    constructor(path: string, content: string) {
        this.path = path;
        this.content = content;
        this.basename = path.split("/").pop()?.replace(".md", "") || "";
    }
}

export class MockVault {
    files: MockFile[] = [];

    getMarkdownFiles() {
        return this.files;
    }

    getAbstractFileByPath(path: string) {
        return this.files.find(f => f.path === path);
    }

    async read(file: MockFile) {
        return file.content;
    }

    async modify(file: MockFile, content: string) {
        file.content = content;
    }

    async append(file: MockFile, content: string) {
        file.content += content;
    }

    async create(path: string, content: string) {
        const file = new MockFile(path, content);
        this.files.push(file);
        return file;
    }
}

export class MockApp {
    vault: MockVault;
    metadataCache = {
        on: () => { }
    };
    workspace = {
        on: () => { }
    };

    constructor() {
        this.vault = new MockVault();
    }
}

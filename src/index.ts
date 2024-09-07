import * as core from '@actions/core';
import * as admin from 'firebase-admin';

let firebase: admin.app.App;

const isDebug: boolean = core.isDebug();
const isRequired = {
	required: true,
};

const initFirebase = () => {
	try {
		core.info('Initialized Firebase Admin Connection');
		core.info('Preparing to load creds...');
		const credentials = core.getInput('credentials', isRequired);
		core.info('loaded credentials');
		let parsedCredentials;
		try {
			parsedCredentials = JSON.parse(credentials);
			core.info('Loaded raw json successfuly');
		} catch (e) {
			parsedCredentials = JSON.parse(atob(credentials));
			core.info('Loaded b64 credentials successfully');
		}
		core.info(`Parsed credentials: ${JSON.stringify(parsedCredentials)}`);
		firebase = admin.initializeApp({
			credential: admin.credential.cert(parsedCredentials as admin.ServiceAccount),
		});
		core.info('Initialized app');
	} catch (error) {
		core.setFailed(JSON.stringify(error));
		process.exit(core.ExitCode.Failure);
	}
};

const getDatabaseType = () => {
	let type = core.getInput('databaseType');

	type = !type ? 'realtime' : type;

	if (type !== 'realtime' && type !== 'firestore') {
		core.setFailed('Database type invalid, please set to either realtime or firestore');
		process.exit(core.ExitCode.Failure);
	}

	return type;
};

const getValue = () => {
	core.info('Trying to parse expected value');
	const value = core.getInput('value');
	core.info('Retrieved Value: ' + value);
	if (!value) {
		return Date.now();
	}

	try {
		return JSON.parse(value);
	} catch {
		const num = Number(value);

		if (isNaN(num)) {
			return value;
		}

		return num;
	}
};

const updateRealtimeDatabase = async (path: string, value: any) => {
	core.info(`Updating Realtime Database at ${path}`);

	await firebase
		.database()
		.ref(path)
		.set(value, (error) => {
			if (error instanceof Error) {
				core.setFailed(JSON.stringify(error));
				process.exit(core.ExitCode.Failure);
			}

			process.exit(core.ExitCode.Success);
		});
};

const updateFirestoreDatabase = (path: string, value: Record<string, any>) => {
	const document = core.getInput('doc', isRequired);

	core.info(`Updating Firestore Database at collection: ${path} document: ${document}`);
	firebase
		.firestore()
		.collection(path)
		.doc(document)
		.set(value)
		.then(
			() => {
				process.exit(core.ExitCode.Success);
			},
			(reason) => {
				core.setFailed(JSON.stringify(reason));
				process.exit(core.ExitCode.Failure);
			}
		);
};

const processAction = () => {
	core.info('processing');
	initFirebase();

	try {
		const databaseType = getDatabaseType();
		const path: string = core.getInput('path', isRequired);
		const value = getValue();

		if (databaseType === 'realtime') {
			updateRealtimeDatabase(path, value);
		}

		if (databaseType === 'firestore') {
			updateFirestoreDatabase(path, value);
		}
	} catch (error) {
		core.setFailed(JSON.stringify(error));
		process.exit(core.ExitCode.Failure);
	}
};

processAction();

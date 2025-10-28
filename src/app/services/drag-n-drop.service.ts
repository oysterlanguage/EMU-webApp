import * as angular from 'angular';

class DragnDropService{
	
	private $q;
	private $rootScope;
	private $window;
	private ModalService;
	private DataService;
	private ValidationService;
	private ConfigProviderService;
	private DragnDropDataService;
	private IoHandlerService;
	private ViewStateService;
	private SoundHandlerService;
	private BinaryDataManipHelperService;
	private BrowserDetectorService;
	private WavParserService;
	private TextGridParserService;
	private LoadedMetaDataService;
	private LevelService;
	
	private drandropBundles;
	private bundleList;
	private sessionName;
	private bundleEntriesByName;
	private convertedByName;
	private bundleOrder;
	constructor($q, $rootScope, $window, ModalService, DataService, ValidationService, ConfigProviderService, DragnDropDataService, IoHandlerService, ViewStateService, SoundHandlerService, BinaryDataManipHelperService, BrowserDetectorService, WavParserService, TextGridParserService, LoadedMetaDataService, LevelService){
		this.$q = $q;
		this.$rootScope = $rootScope;
		this.$window = window;
		this.ModalService = ModalService;
		this.DataService = DataService;
		this.ValidationService = ValidationService;
		this.ConfigProviderService = ConfigProviderService;
		this.DragnDropDataService = DragnDropDataService;
		this.IoHandlerService = IoHandlerService;
		this.ViewStateService = ViewStateService;
		this.SoundHandlerService = SoundHandlerService;
		this.BinaryDataManipHelperService = BinaryDataManipHelperService;
		this.BrowserDetectorService = BrowserDetectorService;
		this.WavParserService = WavParserService;
		this.TextGridParserService = TextGridParserService;
		this.LoadedMetaDataService = LoadedMetaDataService;
		this.LevelService = LevelService;
		
		this.drandropBundles = [];
		this.bundleList = [];
		this.sessionName = 'File(s)';
		this.bundleEntriesByName = {};
		this.convertedByName = {};
		this.bundleOrder = [];
	}
	
	///////////////////////////////
	// public api
	
	///////////////////
	// drag n drop data
	public setData(bundles) {
		if (!Array.isArray(bundles) || bundles.length === 0) {
			console.warn('[EMU][Drop] setData called with no bundles, ignoring');
			return;
		}

		console.log('[EMU][Drop] Processing dropped bundles', bundles.map((bndl) => bndl && bndl[0]));

		var newNames = [];
		var newEntries = [];

		bundles.forEach((bundle) => {
			var name = bundle[0];
			if (!name) {
				console.warn('[EMU][Drop] Encountered bundle without name, skipping', bundle);
				return;
			}
			newNames.push(name);
			newEntries.push({
				name: name,
				wav: bundle[1],
				annotation: bundle[2]
			});
		});

		this.drandropBundles = newEntries;

		this.convertDragnDropData(newEntries, 0).then(() => {
			console.log('[EMU][Drop] Finished conversion for names', newNames);

			newEntries.forEach((entry) => {
				if (!this.bundleEntriesByName[entry.name]) {
					this.bundleEntriesByName[entry.name] = {
						name: entry.name,
						session: this.sessionName
					};
				}
			});

			var filteredOrder = [];
			this.bundleOrder.forEach((name) => {
				if (this.convertedByName[name]) {
					filteredOrder.push(name);
				}
			});
			this.bundleOrder = filteredOrder;

			newNames.forEach((name) => {
				if (this.bundleOrder.indexOf(name) === -1) {
					this.bundleOrder.push(name);
				}
			});

			var currentNames = this.DragnDropDataService.convertedBundles.map((bundle) => bundle.name);
			currentNames.forEach((name) => {
				if (this.bundleOrder.indexOf(name) === -1) {
					this.bundleOrder.push(name);
				}
			});

			Object.keys(this.bundleEntriesByName).forEach((name) => {
				if (!this.convertedByName[name]) {
					delete this.bundleEntriesByName[name];
				}
			});

			Object.keys(this.convertedByName).forEach((name) => {
				if (this.bundleOrder.indexOf(name) === -1) {
					delete this.convertedByName[name];
				}
			});

			this.bundleList = [];
			var convertedList = [];
			console.log('[EMU][Drop] convertedByName keys before rebuild', Object.keys(this.convertedByName));
			this.bundleOrder.forEach((name) => {
				var stored = this.convertedByName[name];
				if (!stored) {
					return;
				}
				console.log('[EMU][Drop] Rebuilding bundle entry for', name);
				var entry = this.bundleEntriesByName[name];
				if (!entry) {
					entry = {
						name: name,
						session: this.sessionName
					};
					this.bundleEntriesByName[name] = entry;
				} else {
					entry.session = this.sessionName;
				}
				this.bundleList.push(entry);
				var cloned = angular.copy(stored);
				cloned.name = name;
				convertedList.push(cloned);
			});
			this.DragnDropDataService.convertedBundles = convertedList.map((bundle) => angular.copy(bundle));
			console.log('[EMU][Drop] Updated converted bundle names', this.DragnDropDataService.convertedBundles.map((bndl) => bndl && bndl.name));

			var defaultName = newNames.length > 0 ? newNames[newNames.length - 1] : undefined;
			console.log('[EMU][Drop] Requested default name', defaultName);
			if (!defaultName && this.bundleOrder.length > 0) {
				defaultName = this.bundleOrder[this.bundleOrder.length - 1];
			}

			var defaultIndex = defaultName ? this.bundleOrder.indexOf(defaultName) : -1;
			if (defaultIndex < 0 && this.bundleOrder.length > 0) {
				defaultIndex = 0;
				defaultName = this.bundleOrder[0];
			}

			if (defaultIndex < 0) {
				this.DragnDropDataService.setDefaultSession(0);
			} else {
				this.DragnDropDataService.setDefaultSession(defaultIndex);
			}
			console.log('[EMU][Drop] Final bundle order', this.bundleOrder, 'default index', defaultIndex, 'default name', defaultName);

			if (this.bundleList.length > 0) {
				this.LoadedMetaDataService.setBundleList(this.bundleList);
				this.LoadedMetaDataService.setDemoDbName(this.sessionName);
			}
			if (defaultIndex >= 0 && this.DragnDropDataService.convertedBundles[defaultIndex]) {
				console.log('[EMU][Drop] Triggering handleLocalFiles for', defaultName);
				this.handleLocalFiles();
			}
			return true;
		}).catch((err) => {
			console.warn('[EMU][Drop] Conversion pipeline failed', err);
		});
	};
	
	public updateAnnotationForBundle(bundleName, annotation) {
		var result:any = {
			success: false
		};
		if (!bundleName) {
			result.error = 'Bundle name is undefined';
			return result;
		}
		if (!annotation) {
			result.error = 'Annotation is undefined';
			return result;
		}
		var clone = angular.copy(annotation);
		if (!clone.name) {
			clone.name = bundleName;
		}
		if (!clone.annotates) {
			clone.annotates = bundleName;
		}
		if (!clone.sampleRate && this.SoundHandlerService.audioBuffer && typeof this.SoundHandlerService.audioBuffer.sampleRate === 'number') {
			clone.sampleRate = this.SoundHandlerService.audioBuffer.sampleRate;
		}
		var validation = this.ValidationService.validateJSO('annotationFileSchema', clone);
		if (validation !== true) {
			result.error = validation;
			return result;
		}
		var stored = this.convertedByName[bundleName];
		if (!stored) {
			result.error = 'Bundle not found: ' + bundleName;
			return result;
		}
		stored.annotation = angular.copy(clone);
		var index = -1;
		this.DragnDropDataService.convertedBundles.forEach((bundle, i) => {
			if (bundle.name === bundleName) {
				bundle.annotation = angular.copy(clone);
				index = i;
			}
		});
		if (index === -1) {
			result.error = 'Bundle not registered in converted bundle list: ' + bundleName;
			return result;
		}
		if (this.bundleOrder.indexOf(bundleName) === -1) {
			this.bundleOrder.push(bundleName);
		}
		this.DragnDropDataService.setDefaultSession(index);
		this.handleLocalFiles();
		result.success = true;
		return result;
	};

	public resetToInitState() {
		delete this.drandropBundles;
		this.drandropBundles = [];
		delete this.bundleList;
		this.bundleList = [];
		this.sessionName = 'File(s)';
		this.bundleEntriesByName = {};
		this.convertedByName = {};
		this.bundleOrder = [];
		this.DragnDropDataService.resetToInitState();
		this.LoadedMetaDataService.resetToInitState();
	};
	
	/**
	* getter this.drandropBundles
	*/
	public getDragnDropData(bundle, type) {
		var name = this.bundleOrder[bundle];
		if (!name) {
			return false;
		}
		var converted = this.convertedByName[name];
		if (!converted) {
			return false;
		}
		if (type === 'wav') {
			return angular.copy(converted.mediaFile);
		} else if (type === 'annotation') {
			return angular.copy(converted.annotation);
		}
		return false;
	};
	
	public generateDrop(data) {
		var objURL;
		if (typeof URL !== 'object' && typeof webkitURL !== 'undefined') {
			objURL = webkitURL.createObjectURL(this.getBlob(data));
		} else {
			objURL = URL.createObjectURL(this.getBlob(data));
		}
		return objURL;
	};
	
	/**
	*
	*/
	public getBlob(data) {
		var blob;
		try {
			blob = new Blob([data], {type: 'text/plain'});
		} catch (e) { // Backwards-compatibility
			blob = new (this.$window.BlobBuilder || this.$window.WebKitBlobBuilder || this.$window.MozBlobBuilder);
			blob.append(data);
			blob = blob.getBlob();
		}
		return blob;
	};
	
	public convertDragnDropData(bundles, i) {
		var defer = this.$q.defer();
		if (bundles.length > i) {
			var data = bundles[i];
			var reader:any = new FileReader();
			var reader2:any = new FileReader();

			if (!data || !data.wav) {
				console.warn('[EMU][Drop] Missing WAV data for entry', data);
				this.convertDragnDropData(bundles, i + 1).then(() => {
					defer.resolve();
				}, (err) => defer.reject(err));
				return defer.promise;
			}

			reader.readAsArrayBuffer(data.wav);
			reader.onloadend = (evt) => {
				if (evt.target.readyState === FileReader.DONE) {
					var res = evt.target.result;
					const base64Audio = this.BinaryDataManipHelperService.arrayBufferToBase64(res);
					this.WavParserService.parseWavAudioBuf(res).then((audioBuffer) => {
						this.SoundHandlerService.audioBuffer = audioBuffer;
						var converted: any = {
							name: data.name,
							mediaFile: {
								encoding: 'BASE64',
								data: base64Audio
							},
							ssffFiles: []
						};
						var finalize = () => {
							var stored = angular.copy(converted);
							stored.name = data.name;
							this.convertedByName[data.name] = stored;
							this.convertDragnDropData(bundles, i + 1).then(() => {
								defer.resolve();
							}, (err) => defer.reject(err));
						};
						if (data.annotation === undefined) {
							converted.annotation = {
								levels: [],
								links: [],
								sampleRate: audioBuffer.sampleRate,
								annotates: data.name,
								name: data.name
							};
							finalize();
						} else if (data.annotation.type === 'textgrid' && data.annotation.file) {
							reader2.readAsText(data.annotation.file);
							reader2.onloadend = (evt2) => {
								if (evt2.target.readyState === FileReader.DONE) {
									this.TextGridParserService.asyncParseTextGrid(evt2.currentTarget.result, data.wav.name, data.name).then((parseMess) => {
										converted.annotation = parseMess;
										finalize();
									}, (errMess) => {
										this.ModalService.open('views/error.html', 'Error parsing TextGrid file: ' + errMess.status.message).then(() => {
											defer.reject();
										});
									});
								}
							};
						} else if (data.annotation.type === 'annotation' && data.annotation.file) {
							reader2.readAsText(data.annotation.file);
							reader2.onloadend = (evt2) => {
								if (evt2.target.readyState === FileReader.DONE) {
									converted.annotation = angular.fromJson(evt2.currentTarget.result);
									finalize();
								}
							};
						} else {
							console.warn('[EMU][Drop] Unknown annotation type for', data.name, data.annotation);
							converted.annotation = {
								levels: [],
								links: [],
								sampleRate: audioBuffer.sampleRate,
								annotates: data.name,
								name: data.name
							};
							finalize();
						}
					}, (errMess) => {
						this.ModalService.open('views/error.html', 'Error parsing audio file: ' + errMess.status.message).then(() => {
							defer.reject();
						});
					});
				}
			};
		} else {
			delete this.drandropBundles;
			this.drandropBundles = [];
			defer.resolve();
		}
		return defer.promise;
	};
	
	/**
	* handling local file drops after loading them
	*/
	public handleLocalFiles() {
		console.log('[EMU][Drop] handleLocalFiles using index', this.DragnDropDataService.sessionDefault, 'order', this.bundleOrder);
		// var ab = DragnDropDataService.convertedBundles[DragnDropDataService.sessionDefault].mediaFile.audioBuffer;
		var annotation;
		if (this.DragnDropDataService.convertedBundles[this.DragnDropDataService.sessionDefault].annotation !== undefined) {
			annotation = this.DragnDropDataService.convertedBundles[this.DragnDropDataService.sessionDefault].annotation;
		}
		else {
			annotation = {levels: [], links: []};
		}
		this.ViewStateService.showDropZone = false;
		this.ViewStateService.setState('loadingSaving');
		// reset history
		this.ViewStateService.somethingInProgress = true;
		this.ViewStateService.somethingInProgressTxt = 'Loading local File: ' + this.DragnDropDataService.convertedBundles[this.DragnDropDataService.sessionDefault].name;
		console.log('[EMU][Drop] Loading bundle', this.DragnDropDataService.convertedBundles[this.DragnDropDataService.sessionDefault].name);
		this.IoHandlerService.httpGetPath('configFiles/standalone_emuwebappConfig.json').then((resp) => {
			// first element of perspectives is default perspective
			this.ViewStateService.curPerspectiveIdx = 0;
			this.ConfigProviderService.setVals(resp.data.EMUwebAppConfig);
			delete resp.data.EMUwebAppConfig; // delete to avoid duplicate
			var validRes;
			validRes = this.ValidationService.validateJSO('emuwebappConfigSchema', this.ConfigProviderService.vals);
			if (validRes === true) {
				this.ConfigProviderService.curDbConfig = resp.data;
				this.ViewStateService.somethingInProgressTxt = 'Parsing WAV file...';
				this.ViewStateService.curViewPort.sS = 0;
				this.ViewStateService.curViewPort.eS = this.SoundHandlerService.audioBuffer.length;
				this.ViewStateService.curViewPort.selectS = -1;
				this.ViewStateService.curViewPort.selectE = -1;
				this.ViewStateService.curClickSegments = [];
				this.ViewStateService.curClickLevelName = undefined;
				this.ViewStateService.curClickLevelType = undefined;
				this.LoadedMetaDataService.setCurBndl(this.DragnDropDataService.convertedBundles[this.DragnDropDataService.sessionDefault]);
				this.ViewStateService.resetSelect();
				this.ViewStateService.curPerspectiveIdx = 0;
				this.DataService.setData(annotation);
				var lNames = [];
				var levelDefs = [];
				annotation.levels.forEach((l) => {
					if (l.type === 'SEGMENT' || l.type === 'EVENT') {
						lNames.push(l.name);
						levelDefs.push({
							'name': l.name,
							'type': l.type,
							'attributeDefinitions': {
								'name': l.name,
								'type': 'string'
							}
						});
					}
				});
				
				// set level defs
				this.ConfigProviderService.curDbConfig.levelDefinitions = levelDefs;
				this.ViewStateService.setCurLevelAttrDefs(this.ConfigProviderService.curDbConfig.levelDefinitions);
				this.ConfigProviderService.setPerspectivesOrder(this.ViewStateService.curPerspectiveIdx, lNames);
				//ConfigProviderService.vals.perspectives[ViewStateService.curPerspectiveIdx].levelCanvases.order = lNames;
				
				// set all ssff files
				this.ViewStateService.somethingInProgressTxt = 'Parsing SSFF files...';
				validRes = this.ValidationService.validateJSO('annotationFileSchema', annotation);
				if (validRes === true) {
					this.DataService.setLinkData(annotation.links);
					this.ViewStateService.setState('labeling');
					this.ViewStateService.somethingInProgress = false;
					this.ViewStateService.somethingInProgressTxt = 'Done!';
				} else {
					this.ModalService.open('views/error.html', 'Error validating annotation file: ' + JSON.stringify(validRes, null, 4)).then(() => {
						//AppStateService.resetToInitState();
						this.resetToInitState();
					});
				}
				// select first level
				if (!this.BrowserDetectorService.isBrowser.HeadlessChrome()){
					this.ViewStateService.selectLevel(false, this.ConfigProviderService.vals.perspectives[this.ViewStateService.curPerspectiveIdx].levelCanvases.order, this.LevelService);
				}
				
				
			}
			
		});
		this.ViewStateService.somethingInProgress = false;
	};
	
}

angular.module('emuwebApp')
.service('DragnDropService', ['$q', '$rootScope', '$window', 'ModalService', 'DataService', 'ValidationService', 'ConfigProviderService', 'DragnDropDataService', 'IoHandlerService', 'ViewStateService', 'SoundHandlerService', 'BinaryDataManipHelperService', 'BrowserDetectorService', 'WavParserService', 'TextGridParserService', 'LoadedMetaDataService', 'LevelService', DragnDropService]);

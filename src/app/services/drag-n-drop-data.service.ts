import * as angular from 'angular';

class DragnDropDataService{
	private convertedBundles;
	private sessionDefault;
	private $q;
	
	constructor($q){
		this.$q = $q;
		this.convertedBundles = [];
		this.sessionDefault = '';
	}
	
	///////////////////////////////
	// public api
	
	public getBundle(name) {
		var defer = this.$q.defer();
		console.log('[EMU][Drop] getBundle request for', name, 'available', this.convertedBundles.map((bndl) => bndl && bndl.name));
		var matched = false;
		this.convertedBundles.forEach((bundle) => {
			if (bundle.name === name) {
				console.log('[EMU][Drop] getBundle matched', bundle.name);
				matched = true;
				var bc = {} as any;
				Object.keys(bundle).forEach((key) => {
					if (key !== 'name' && key !== 'mediaFile') {
						bc[key] = angular.copy(bundle[key]);
					}
				});
				if (bundle.mediaFile) {
					if (bundle.mediaFile.encoding === 'ARRAYBUFFER' && bundle.mediaFile.data instanceof ArrayBuffer) {
						bc.mediaFile = {
							encoding: 'ARRAYBUFFER',
							data: bundle.mediaFile.data
						};
					} else {
						bc.mediaFile = angular.copy(bundle.mediaFile);
					}
				}
				defer.resolve({
					status: 200,
					data: bc
				});
			}
		});
		if (!matched) {
			console.warn('[EMU][Drop] getBundle did not find bundle for', name);
			defer.reject({
				status: 404,
				message: 'Bundle not found: ' + name
			});
		}
		return defer.promise;
	};
	
	public resetToInitState() {
		this.convertedBundles = [];
		this.sessionDefault = '';
	};
	
	public setDefaultSession(name) {
		this.sessionDefault = name;
	};
	
	public getDefaultSession() {
		return this.sessionDefault;
	};
	
}

angular.module('emuwebApp')
.service('DragnDropDataService', ['$q', DragnDropDataService]);

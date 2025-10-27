'use strict';

describe('Service: DragnDropService', function () {
  var $scope;
  var $q;

  // load the controller's module
  beforeEach(module('emuwebApp'));

  beforeEach(inject(function(_$rootScope_, _$q_) {
    $q = _$q_;
    $scope = _$rootScope_.$new();
  }));

  var testData = [
      ['test1','wavData1','annotationData1'],
      ['test2','wavData2','annotationData2']
  ];

  it('should resetToInitState', inject(function (DragnDropService) {
    // set any data
    DragnDropService.drandropBundles.push('test');
    DragnDropService.bundleList.push('test');
    DragnDropService.bundleOrder.push('test');
    DragnDropService.bundleEntriesByName.test = {};
    DragnDropService.convertedByName.test = {};
    DragnDropService.resetToInitState();
    expect(DragnDropService.drandropBundles.length).toBe(0);
    expect(DragnDropService.bundleList.length).toBe(0);
    expect(DragnDropService.bundleOrder.length).toBe(0);
    expect(Object.keys(DragnDropService.bundleEntriesByName).length).toBe(0);
    expect(Object.keys(DragnDropService.convertedByName).length).toBe(0);
  }));

  it('should setData', inject(function (DragnDropService, loadedMetaDataService) {
    // set according data
    var def = $q.defer();
    spyOn(loadedMetaDataService, 'setBundleList');
    spyOn(loadedMetaDataService, 'setCurBndlName');
    spyOn(loadedMetaDataService, 'setDemoDbName');
    spyOn(DragnDropService, 'handleLocalFiles');
    spyOn(DragnDropService, 'convertDragnDropData').and.returnValue(def.promise);
    DragnDropService.setData(testData);
    expect(DragnDropService.convertDragnDropData).toHaveBeenCalledWith(jasmine.arrayContaining([
      jasmine.objectContaining({name: 'test1', wav: 'wavData1', annotation: 'annotationData1'}),
      jasmine.objectContaining({name: 'test2', wav: 'wavData2', annotation: 'annotationData2'})
    ]), 0);
    def.resolve();
    $scope.$apply();
    expect(loadedMetaDataService.setBundleList).toHaveBeenCalled();
    expect(loadedMetaDataService.setCurBndlName).toHaveBeenCalled();
    expect(loadedMetaDataService.setDemoDbName).toHaveBeenCalled();
    expect(DragnDropService.handleLocalFiles).toHaveBeenCalled();
  }));


  it('should getBlob', inject(function (DragnDropService) {
     expect(DragnDropService.getBlob().toString()).toBe('[object Blob]');
  }));

  it('should generateDrop', inject(function (DragnDropService) {
     expect(DragnDropService.generateDrop().toString().substr(0, 12)).toBe('blob:http://');
  }));

  it('should getDragnDropData', inject(function (DragnDropService) {
    DragnDropService.bundleOrder = ['test1', 'test2'];
    DragnDropService.convertedByName = {
      test1: {
        mediaFile: {encoding: 'BASE64', data: 'wavData1'},
        annotation: {payload: 'annotationData1'}
      },
      test2: {
        mediaFile: {encoding: 'BASE64', data: 'wavData2'},
        annotation: {payload: 'annotationData2'}
      }
    };
    expect(DragnDropService.getDragnDropData(0, 'wav')).toEqual({encoding: 'BASE64', data: 'wavData1'});
    expect(DragnDropService.getDragnDropData(0, 'annotation')).toEqual({payload: 'annotationData1'});
    expect(DragnDropService.getDragnDropData(1, 'wav')).toEqual({encoding: 'BASE64', data: 'wavData2'});
    expect(DragnDropService.getDragnDropData(1, 'annotation')).toEqual({payload: 'annotationData2'});
    expect(DragnDropService.getDragnDropData(1, 'annotation12')).toEqual(false);
  }));

  it('should handleLocalFiles', inject(function (Wavparserservice,
                                                 Validationservice,
                                                 Iohandlerservice,
                                                 DragnDropService,
                                                 modalService,
                                                 appStateService,
                                                 DragnDropDataService,
                                                 viewState) {
    var defio = $q.defer();
    var defwav = $q.defer();
    DragnDropDataService.sessionDefault = 0;
    DragnDropDataService.convertedBundles[0] = {};
    DragnDropDataService.convertedBundles[0].mediaFile = {};
    DragnDropDataService.convertedBundles[0].mediaFile.data = msajc003_bndl.mediaFile.data;
    DragnDropDataService.convertedBundles[0].annotation = msajc003_bndl.annotation;
    viewState.curPerspectiveIdx = 0;
    spyOn(viewState, 'selectLevel').and.returnValue(true);
    spyOn(Iohandlerservice, 'httpGetPath').and.returnValue(defio.promise);
    spyOn(Validationservice, 'validateJSO').and.returnValue(true);
    DragnDropService.handleLocalFiles();
    expect(Iohandlerservice.httpGetPath).toHaveBeenCalled();
    defio.resolve({data: defaultEmuwebappConfig});
    $scope.$apply();
  }));

});

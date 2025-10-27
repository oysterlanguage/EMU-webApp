import * as angular from 'angular';

class WavParserService{
    private $q;
    private $window;
    
    private defer;
    
    constructor($q, $window){
        this.$q = $q;
        this.$window = $window;
    }
    
    /**
    * convert binary values to strings
    * (currently duplicate of function in wavParserWorkerClass)
    * SIC this should be in an external service shouldn't it?
    * @param ab array buffer containing string binary values
    */
    public ab2str(ab) {
        var unis = [];
        for (var i = 0; i < ab.length; i++) {
            unis.push(ab[i]);
        }
        return String.fromCharCode.apply(null, unis);
    };
    
    
    /**
    * parse header of wav file
    * (currently duplicate of function in wavParserWorkerClass)
    * @param buf array buffer containing entire wav file
    */
    public parseWavHeader(buf){
        buf = this.ensureUint8Array(buf);
        
        var headerInfos = {} as any;
        
        var curBinIdx, curBuffer, curBufferView;
        
        // ChunkId == RIFF CHECK
        curBinIdx = 0;
        curBuffer = buf.subarray(curBinIdx, 4);
        curBufferView = new Uint8Array(curBuffer);
        headerInfos.ChunkID = this.ab2str(curBufferView);
        
        if (headerInfos.ChunkID !== 'RIFF') {
            // console.error('Wav read error: ChunkID not RIFF. Got ' + headerInfos.ChunkID);
            return ({
                'status': {
                    'type': 'ERROR',
                    'message': 'Wav read error: ChunkID not RIFF but ' + headerInfos.ChunkID
                }
            });
        }
        
        
        // ChunkSize
        curBinIdx = 4;
        curBuffer = buf.subarray(curBinIdx, 4);
        curBufferView = new Uint32Array(curBuffer);
        headerInfos.ChunkSize = curBufferView[0];
        
        // Format == WAVE CHECK
        curBinIdx = 8;
        curBuffer = buf.subarray(curBinIdx, 4);
        curBufferView = new Uint8Array(curBuffer);
        headerInfos.Format = this.ab2str(curBufferView);
        if (headerInfos.Format !== 'WAVE') {
            // console.error('Wav read error: Format not WAVE. Got ' + headerInfos.Format);
            return ({
                'status': {
                    'type': 'ERROR',
                    'message': 'Wav read error: Format not WAVE but ' + headerInfos.Format
                }
            });
        }
        
        // look for 'fmt ' sub-chunk as described here: http://soundfile.sapp.org/doc/WaveFormat/
        var foundChunk = false;
        var fmtBinIdx = 12; // 12 if first sub-chunk
        while(!foundChunk){
            curBuffer = buf.subarray(fmtBinIdx, 4);
            curBufferView = new Uint8Array(curBuffer);
            var cur4chars = this.ab2str(curBufferView);
            if(cur4chars === 'fmt '){
                // console.log('found fmt chunk at' + fmtBinIdx);
                headerInfos.FmtSubchunkID = 'fmt ';
                foundChunk = true;
                
            }else{
                fmtBinIdx += 1;
            }
            if(cur4chars === 'data'){
                return ({
                    'status': {
                        'type': 'ERROR',
                        'message': 'Wav read error: Reached end of header by reaching data sub-chunk without finding "fmt " sub-chunk   '
                    }
                });
            }
            
        }
        
        // FmtSubchunkSize parsing
        curBinIdx = fmtBinIdx + 4; // 16
        curBuffer = buf.subarray(curBinIdx, 4);
        curBufferView = new Uint32Array(curBuffer);
        headerInfos.FmtSubchunkSize = curBufferView[0];
        
        // AudioFormat == 1  CHECK
        curBinIdx = fmtBinIdx + 8; // 20
        curBuffer = buf.subarray(curBinIdx, 2);
        curBufferView = new Uint16Array(curBuffer);
        headerInfos.AudioFormat = curBufferView[0];
        if ([0, 1].indexOf(headerInfos.AudioFormat) === -1) {
            // console.error('Wav read error: AudioFormat not 1');
            return ({
                'status': {
                    'type': 'ERROR',
                    'message': 'Wav read error: AudioFormat not 0 or 1 but ' + headerInfos.AudioFormat
                }
            });
        }
        
        // NumChannels == 1  CHECK
        curBinIdx = fmtBinIdx + 10; // 22
        curBuffer = buf.subarray(curBinIdx, 2);
        curBufferView = new Uint16Array(curBuffer);
        headerInfos.NumChannels = curBufferView[0];
        if (headerInfos.NumChannels < 1) {
            return ({
                'status': {
                    'type': 'ERROR',
                    'message': 'Wav read error: NumChannels not greater than 1 but ' + headerInfos.NumChannels
                }
            });
        }
        
        // SampleRate
        curBinIdx = fmtBinIdx + 12; // 24
        curBuffer = buf.subarray(curBinIdx, 4);
        curBufferView = new Uint32Array(curBuffer);
        headerInfos.SampleRate = curBufferView[0];
        
        // ByteRate
        curBinIdx = fmtBinIdx + 16; // 28
        curBuffer = buf.subarray(curBinIdx, 4);
        curBufferView = new Uint32Array(curBuffer);
        headerInfos.ByteRate = curBufferView[0];
        
        // BlockAlign
        curBinIdx = fmtBinIdx + 20; // 32
        curBuffer = buf.subarray(curBinIdx, 2);
        curBufferView = new Uint16Array(curBuffer);
        headerInfos.BlockAlign = curBufferView[0];
        
        // BitsPerSample
        curBinIdx = fmtBinIdx + 12; // 34
        curBuffer = buf.subarray(curBinIdx, 2);
        curBufferView = new Uint16Array(curBuffer);
        headerInfos.BitsPerSample = curBufferView[0];
        
        // console.log(headerInfos);
        
        // look for data chunk size
        var foundChunk = false;
        var dataBinIdx = fmtBinIdx + 14; // 36
        while(!foundChunk){
            curBuffer = buf.subarray(dataBinIdx, 4);
            curBufferView = new Uint8Array(curBuffer);
            var cur4chars = this.ab2str(curBufferView);
            if(cur4chars === 'data'){
                foundChunk = true;
                curBuffer = buf.subarray(dataBinIdx + 4, 4);
                curBufferView = new Uint32Array(curBuffer);
                headerInfos.dataChunkSize = curBufferView[0];
            }else{
                dataBinIdx += 1;
            }
        }
        
        return headerInfos;
        
    };
    
    
    
    /**
    * parse buffer containing wav file using webworker
    * @param buf
    * @returns promise
    */
    public parseWavAudioBuf(buf) {
        let uint8;
        let arrayBuffer;
        try {
            uint8 = this.ensureUint8Array(buf);
            arrayBuffer = this.toTightArrayBuffer(uint8);
        } catch (e) {
            this.defer = this.$q.defer();
            const err = {} as any;
            err.status = {} as any;
            err.status.message = 'Error parsing audio file: Unsupported buffer type.';
            this.defer.reject(err);
            return this.defer.promise;
        }
        
        var headerInfos = this.parseWavHeader(uint8);
        if(typeof headerInfos.status !== 'undefined' && headerInfos.status.type === 'ERROR'){
            if (this.shouldTryGenericDecode(headerInfos.status.message, uint8)) {
                return this.decodeGenericAudio(arrayBuffer, headerInfos.status.message);
            }
            this.defer = this.$q.defer();
            this.defer.reject(headerInfos); // headerInfos now contains only error message
            return this.defer.promise;
        }else{
            try {
                var offlineCtx = new (this.$window.OfflineAudioContext || this.$window.webkitOfflineAudioContext)(
                    headerInfos.NumChannels,
                    headerInfos.dataChunkSize/headerInfos.NumChannels/(headerInfos.BitsPerSample/8),
                    headerInfos.SampleRate);
                    
                    this.defer = this.$q.defer();
                    // using non promise version as Safari doesn't support it yet
                    offlineCtx.decodeAudioData(arrayBuffer,
                        (decodedData) => { this.defer.resolve(decodedData); },
                        (error) => { this.defer.reject(error) });
                        
                        
                        return this.defer.promise;
                        
                    }catch (e){
                        // construct error object
                        var errObj = {} as any;
                        errObj.exception = JSON.stringify(e, null, 4);
                        errObj.EMUwebAppComment = 'This could be because you are using Safari (or another webkit based browser) and the audio sample rate is not in the interval >= 44100 and <= 96000 which seem to currently be the only sample rates supported by the webkitOfflineAudioContext (see here https://github.com/WebKit/webkit/blob/29271ffbec500cd9c92050fcc0e613adffd0ce6a/Source/WebCore/Modules/webaudio/AudioContext.cpp#L111)';
                        
                        var err = {} as any;
                        err.status = {} as any;
                        err.status.message = JSON.stringify(errObj, null, 4);
                        
                        this.defer = this.$q.defer();
                        this.defer.reject(err); // headerInfos now contains only error message
                        return this.defer.promise;
                        
                    }
                    
                }
                
                
            };
            
            private ensureUint8Array(buf: any): Uint8Array {
                if (buf instanceof Uint8Array) {
                    return buf;
                }
                if (buf instanceof ArrayBuffer) {
                    return new Uint8Array(buf);
                }
                if (buf && buf.buffer instanceof ArrayBuffer) {
                    return new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength);
                }
                throw new Error('Unsupported buffer type');
            }
            
            private toTightArrayBuffer(buf: Uint8Array): ArrayBuffer {
                if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
                    return buf.buffer;
                }
                return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            }
            
            private shouldTryGenericDecode(message: string, head: Uint8Array): boolean {
                const msg = (message || '').toLowerCase();
                if (msg.indexOf('chunkid not riff') !== -1 || msg.indexOf('format not wave') !== -1) {
                    return true;
                }
                return this.looksLikeMp3(head);
            }
            
            private looksLikeMp3(head: Uint8Array): boolean {
                if (!head || head.length < 3) {
                    return false;
                }
                // ID3 tag
                if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
                    return true;
                }
                // Frame sync bits 11111111 111xxxxx
                if (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0) {
                    return true;
                }
                return false;
            }
            
            private decodeGenericAudio(arrayBuffer: ArrayBuffer, previousMessage?: string) {
                const AudioCtx = this.$window.AudioContext || this.$window.webkitAudioContext;
                this.defer = this.$q.defer();
                if (!AudioCtx) {
                    const err = {} as any;
                    err.status = {} as any;
                    err.status.message = 'Error parsing audio file: Web Audio API not supported in this browser.';
                    this.defer.reject(err);
                    return this.defer.promise;
                }
                
                let audioCtx;
                try {
                    audioCtx = new AudioCtx();
                } catch (e) {
                    const err = {} as any;
                    err.status = {} as any;
                    err.status.message = 'Error initializing audio decoder: ' + e;
                    this.defer.reject(err);
                    return this.defer.promise;
                }
                
                audioCtx.decodeAudioData(arrayBuffer,
                    (decodedData) => {
                        if (typeof audioCtx.close === 'function') {
                            audioCtx.close().catch(() => undefined);
                        }
                        this.defer.resolve(decodedData);
                    },
                    (error) => {
                        if (typeof audioCtx.close === 'function') {
                            audioCtx.close().catch(() => undefined);
                        }
                        const err = {} as any;
                        err.status = {} as any;
                        const errorMsg = error && error.message ? error.message : error;
                        if (previousMessage) {
                            err.status.message = 'Error parsing audio file: ' + errorMsg + ' (' + previousMessage + ')';
                        } else {
                            err.status.message = 'Error parsing audio file: ' + errorMsg;
                        }
                        this.defer.reject(err);
                    });
                
                return this.defer.promise;
            }
            
        }
        
        angular.module('emuwebApp')
        .service('WavParserService', ['$q', '$window', WavParserService]);

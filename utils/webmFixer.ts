
// This is a TypeScript adaptation of a popular JavaScript gist by `legokichi`
// and subsequent improvements from the community, designed to fix the duration
// of WebM files created by MediaRecorder.

class WebMWriter {
    private parts: (Blob | ArrayBuffer)[] = [];

    public write(part: Blob | ArrayBuffer): void {
        this.parts.push(part);
    }

    public getBlob(mimeType: string): Blob {
        return new Blob(this.parts, { type: mimeType });
    }
}

const getEBMLByteLength = (value: number): number => {
    if (value <= 0x7F) return 1;
    if (value <= 0x3FFF) return 2;
    if (value <= 0x1FFFFF) return 3;
    if (value <= 0xFFFFFFF) return 4;
    if (value <= 0x7FFFFFFFF) return 5;
    if (value <= 0x3FFFFFFFFFF) return 6;
    if (value <= 0x1FFFFFFFFFFFF) return 7;
    if (value <= 0xFFFFFFFFFFFFFF) return 8;
    throw new Error("EBML VINT size exceeded.");
};

const writeEBMLVarInt = (value: number): ArrayBuffer => {
    const byteLength = getEBMLByteLength(value);
    const buffer = new ArrayBuffer(byteLength);
    const view = new DataView(buffer);

    let val = value;
    for (let i = 0; i < byteLength; i++) {
        view.setUint8(byteLength - 1 - i, val & 0xFF);
        val >>= 8;
    }
    view.setUint8(0, view.getUint8(0) | (1 << (8 - byteLength)));
    return buffer;
};

const createCuePoint = (time: number, clusterOffset: number): ArrayBuffer => {
    const timeBuffer = new ArrayBuffer(8);
    new DataView(timeBuffer).setFloat64(0, time);

    const cueTimeId = new Uint8Array([0xB3]);
    const cueTimeSize = writeEBMLVarInt(8);

    const cueTrackPositionsId = new Uint8Array([0xB7]);
    const cueTrackPositionsSize = writeEBMLVarInt(1 + 1 + getEBMLByteLength(clusterOffset));
    
    const cueTrackId = new Uint8Array([0xF7]);
    const cueTrackSize = writeEBMLVarInt(1);
    const cueTrackValue = new Uint8Array([1]);

    const cueClusterPositionId = new Uint8Array([0xF1]);
    const cueClusterPositionSize = writeEBMLVarInt(getEBMLByteLength(clusterOffset));
    const cueClusterPositionValue = writeEBMLVarInt(clusterOffset);
    
    const payload = [
        cueTimeId, cueTimeSize, new Uint8Array(timeBuffer),
        cueTrackPositionsId, cueTrackPositionsSize,
        cueTrackId, cueTrackSize, cueTrackValue,
        cueClusterPositionId, cueClusterPositionSize, cueClusterPositionValue,
    ].map(b => new Uint8Array(b));

    let totalLength = 0;
    payload.forEach(p => totalLength += p.byteLength);

    const cuePointId = new Uint8Array([0xBB]);
    const cuePointSize = writeEBMLVarInt(totalLength);
    
    const finalBuffer = new Uint8Array(2 + totalLength);
    finalBuffer.set(cuePointId, 0);
    finalBuffer.set(new Uint8Array(cuePointSize), 1);
    
    let offset = 2;
    payload.forEach(p => {
        finalBuffer.set(p, offset);
        offset += p.byteLength;
    });

    return finalBuffer.buffer;
};

const readEBMLVarInt = (buffer: Uint8Array, offset: number): { value: number, length: number } => {
    const firstByte = buffer[offset];
    let length = 1;
    while (length <= 8 && !(firstByte & (1 << (8 - length)))) {
        length++;
    }

    if (length > 8) throw new Error("Invalid EBML VINT length");

    let value = firstByte & ((1 << (8 - length)) - 1);
    for (let i = 1; i < length; i++) {
        value = (value << 8) | buffer[offset + i];
    }
    
    return { value, length };
};

export const fixWebmDuration = (blob: Blob, duration: number): Promise<Blob> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const buffer = e.target?.result as ArrayBuffer;
            if (!buffer) {
                resolve(blob);
                return;
            }

            const uint8 = new Uint8Array(buffer);
            let offset = 0;
            let segmentOffset = -1;
            let infoOffset = -1;
            let timecodeScale = -1;
            let durationOffset = -1;
            let cuesOffset = -1;

            const clusterOffsets: { time: number, offset: number }[] = [];

            // Simple EBML parser
            while (offset < uint8.length) {
                const idInfo = readEBMLVarInt(uint8, offset);
                const id = idInfo.value;
                offset += idInfo.length;

                const sizeInfo = readEBMLVarInt(uint8, offset);
                const size = sizeInfo.value;
                offset += sizeInfo.length;

                const contentOffset = offset;

                if (id === 0x18538067) { // Segment
                    segmentOffset = contentOffset;
                } else if (id === 0x1549A966) { // Info
                    infoOffset = contentOffset;
                } else if (id === 0x2AD7B1) { // TimecodeScale
                    if(infoOffset !== -1) {
                       timecodeScale = new DataView(buffer, contentOffset, size).getUint32(0);
                    }
                } else if (id === 0x4489) { // Duration
                    if(infoOffset !== -1) {
                        durationOffset = contentOffset;
                    }
                } else if (id === 0x1F43B675) { // Cluster
                    // find timecode of cluster
                    let clusterInternalOffset = contentOffset;
                    while(clusterInternalOffset < contentOffset + size) {
                        const clusterIdInfo = readEBMLVarInt(uint8, clusterInternalOffset);
                        clusterInternalOffset += clusterIdInfo.length;
                        const clusterSizeInfo = readEBMLVarInt(uint8, clusterInternalOffset);
                        clusterInternalOffset += clusterSizeInfo.length;
                        if (clusterIdInfo.value === 0xE7) { // Timecode
                            const time = new DataView(buffer, clusterInternalOffset, clusterSizeInfo.value).getUint16(0);
                            clusterOffsets.push({ time, offset: contentOffset - segmentOffset });
                            break;
                        }
                        clusterInternalOffset += clusterSizeInfo.value;
                    }
                } else if (id === 0x1C53BB6B) { // Cues
                    cuesOffset = contentOffset - sizeInfo.length - idInfo.length;
                }

                offset += size;
            }

            if (segmentOffset === -1 || infoOffset === -1 || timecodeScale === -1) {
                resolve(blob);
                return;
            }

            const writer = new WebMWriter();
            
            // Write everything before the Info element
            writer.write(buffer.slice(0, infoOffset));
            
            // Write new duration if it doesn't exist, or patch if it does
            if (durationOffset === -1) {
                const durationId = new Uint8Array([0x44, 0x89]);
                const durationSize = writeEBMLVarInt(8);
                const durationValue = new ArrayBuffer(8);
                new DataView(durationValue).setFloat64(0, duration);
                writer.write(durationId);
                writer.write(durationSize);
                writer.write(durationValue);
            }

            let writeOffset = infoOffset;
            let infoEndOffset = -1;

            // Find the end of the Info element
            offset = infoOffset;
            const sizeInfo = readEBMLVarInt(uint8, infoOffset - readEBMLVarInt(uint8, infoOffset - 2).length - readEBMLVarInt(uint8, infoOffset-2).length);
            infoEndOffset = infoOffset + sizeInfo.value;


            while (writeOffset < infoEndOffset) {
                const idInfo = readEBMLVarInt(uint8, writeOffset);
                writeOffset += idInfo.length;
                const sizeInfo = readEBMLVarInt(uint8, writeOffset);
                writeOffset += sizeInfo.length;
                
                if (idInfo.value === 0x4489) { // Duration
                    const durationValue = new ArrayBuffer(8);
                    new DataView(durationValue).setFloat64(0, duration);
                    writer.write(buffer.slice(infoOffset, writeOffset));
                    writer.write(durationValue);
                    infoOffset = writeOffset + sizeInfo.value;
                }
                writeOffset += sizeInfo.value;
            }
            
            writer.write(buffer.slice(infoOffset, cuesOffset === -1 ? segmentOffset + readEBMLVarInt(uint8, segmentOffset-1).value: cuesOffset));
            
            // Create and write Cues element
            let cuesPayload = new Uint8Array(0);
            clusterOffsets.forEach(({ time, offset }) => {
                const cuePoint = new Uint8Array(createCuePoint(time, offset));
                const newPayload = new Uint8Array(cuesPayload.length + cuePoint.length);
                newPayload.set(cuesPayload, 0);
                newPayload.set(cuePoint, cuesPayload.length);
                cuesPayload = newPayload;
            });

            const cuesId = new Uint8Array([0x1C, 0x53, 0xBB, 0x6B]);
            const cuesSize = writeEBMLVarInt(cuesPayload.length);
            writer.write(cuesId);
            writer.write(cuesSize);
            writer.write(cuesPayload.buffer);

            // Write the rest of the file
            writer.write(buffer.slice(cuesOffset === -1 ? segmentOffset + readEBMLVarInt(uint8, segmentOffset-1).value : cuesOffset));

            const finalBlob = writer.getBlob('audio/webm');
            resolve(finalBlob);
        };
        reader.readAsArrayBuffer(blob);
    });
};

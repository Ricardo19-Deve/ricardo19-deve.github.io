// Read the unmodified GLB independently of GLTFLoader's weight normalization.
// Buffer views compressed with EXT_meshopt_compression are decoded with options.meshopt
// (three's MeshoptDecoder, already ready) into their uncompressed layout first.
export function readGLB(buffer,options={}) {
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x46546c67) throw new Error('The asset is not a binary glTF file.');
  let json, binaryOffset=0;
  for(let at=12;at<buffer.byteLength;){
    const size=view.getUint32(at,true),type=view.getUint32(at+4,true);
    if(type===0x4e4f534a) json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,at+8,size)));
    if(type===0x004e4942) binaryOffset=at+8;
    at+=8+size;
  }
  if(!json||!binaryOffset) throw new Error('Missing GLB JSON or binary chunk.');
  const decoded=new Map();
  function bufferViewData(index){
    const b=json.bufferViews[index],ext=b.extensions?.EXT_meshopt_compression;
    if(!ext) return {view,base:binaryOffset+(b.byteOffset||0)};
    if(!decoded.has(index)){
      if(!options.meshopt) throw new Error('A meshopt decoder is required for this GLB.');
      if((ext.buffer||0)!==0) throw new Error('Compressed data must live in the GLB binary chunk.');
      const target=new Uint8Array(ext.count*ext.byteStride);
      options.meshopt.decodeGltfBuffer(target,ext.count,ext.byteStride,new Uint8Array(buffer,binaryOffset+(ext.byteOffset||0),ext.byteLength),ext.mode,ext.filter||'NONE');
      decoded.set(index,new DataView(target.buffer));
    }
    return {view:decoded.get(index),base:0};
  }
  return {json,accessor(index){
    const a=json.accessors[index],b=json.bufferViews[a.bufferView];
    if(a.sparse) throw new Error('Sparse accessors require a separate decoder.');
    const counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    const types={5120:['getInt8',1,127],5121:['getUint8',1,255],5122:['getInt16',2,32767],5123:['getUint16',2,65535],5125:['getUint32',4,4294967295],5126:['getFloat32',4,1]};
    const [get,bytes,scale]=types[a.componentType],width=counts[a.type],stride=b.byteStride||width*bytes;
    const data=bufferViewData(a.bufferView),values=new Float32Array(a.count*width),offset=data.base+(a.byteOffset||0);
    for(let i=0;i<a.count;i++) for(let c=0;c<width;c++){
      let value=data.view[get](offset+i*stride+c*bytes,true);
      if(a.normalized) value=Math.max(value/scale,a.componentType===5120||a.componentType===5122?-1:0);
      values[i*width+c]=value;
    }
    return {array:values,count:a.count,width};
  }};
}

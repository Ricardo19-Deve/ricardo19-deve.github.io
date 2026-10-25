// Read the unmodified GLB independently of GLTFLoader's weight normalization.
export function readGLB(buffer) {
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
  return {json,accessor(index){
    const a=json.accessors[index],b=json.bufferViews[a.bufferView];
    if(a.sparse) throw new Error('Sparse accessors require a separate decoder.');
    const counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    const types={5120:['getInt8',1,127],5121:['getUint8',1,255],5122:['getInt16',2,32767],5123:['getUint16',2,65535],5125:['getUint32',4,4294967295],5126:['getFloat32',4,1]};
    const [get,bytes,scale]=types[a.componentType],width=counts[a.type],stride=b.byteStride||width*bytes;
    const values=new Float32Array(a.count*width),offset=binaryOffset+(b.byteOffset||0)+(a.byteOffset||0);
    for(let i=0;i<a.count;i++) for(let c=0;c<width;c++){
      let value=view[get](offset+i*stride+c*bytes,true);
      if(a.normalized) value=Math.max(value/scale,a.componentType===5120||a.componentType===5122?-1:0);
      values[i*width+c]=value;
    }
    return {array:values,count:a.count,width};
  }};
}
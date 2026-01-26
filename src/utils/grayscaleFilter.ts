export type FilterType = 'grayscale' | 'sepia' | 'none'

export const applyFilter = async(
    image: HTMLImageElement,
    filter: FilterType,
    format: 'jpeg'|'png' = 'jpeg'
):Promise<Blob> =>{
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')
    if(!ctx){
        throw new Error("failed to get canvas ctx")
    }

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    if(filter === 'grayscale'){
        ctx.filter = 'grayscale(100%)'
    }else if(filter === 'sepia'){
        ctx.filter = 'sepia(100%)'
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject)=>{
        canvas.toBlob(blob=>{
            if(blob){
                resolve(blob)
            }else{
                reject(new Error('canvas is empty'))
            }
        }, `image/${format}`)
    })
}
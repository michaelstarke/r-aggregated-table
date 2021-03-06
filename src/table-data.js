/**
 * Created by IvanP on 21.09.2016.
 */
import ReportalBase from "r-reportal-base";
//import TableDataRowMeta from "./TableDataRowMeta";

/**
 * A base class for stripping data from HTML tables
 * */
class TableData {
  /**
   * Detects if the dataset is multi-dimentional and sets classes on items: a rowspanning cell gets a `.blockCell` and the row containing it a `.firstInBlock`
   * __Doesn't work with `Horizontal Percents` enabled!__
   * @param {HTMLTableElement} source - source table
   * @return {Boolean} Returns if the data in table is multi-dimentional
   * */
  static detectMultidimensional(source){
    let multidimensional = false;
    let blocks = source.parentNode.querySelectorAll(`table#${source.id}>tbody>tr>td:nth-child(1)[rowspan]`);
    if(blocks.length>0){
      multidimensional = true;
      [].slice.call(blocks).forEach(blockCell=>{
        blockCell.classList.add('blockCell');
        blockCell.parentNode.classList.add('firstInBlock');
      });
    }
    return multidimensional
  }

  /**
   * Extracts data from a given cell. Override in an inherited class if you need to add any metadata to it.
   * @param {HTMLTableCellElement} cell - cell element to have data stripped off it
   * @param {HTMLTableCellElement} rowIndex - index of the row it's in
   * @param {HTMLTableCellElement} columnIndex - index of the column it's in
   * @returns {?String|?Number} Returns a `String`, a `Number` or a `null` (if data is absent in the cell or its text content boils down to an empty string - i.e. there are no characters in the cell, only HTML tags)
   * */
  static prepareDataCell(cell, rowIndex, columnIndex){
   return ReportalBase.isNumber(cell.textContent.trim());
    /*return {
        cell,
        data: ReportalBase.isNumber(cell.textContent.trim()),
        rowIndex,
        columnIndex
      }*/
  }

  /**
   * A universal data-extraction function. It strips data from a table's body. Data can be stripped by rows (horizontally) or by columns (vertically) which is controlled by `direction`. It accounts for a spanning block cell and may exclude it.
   * @param {Object} options - options to configure the way data is stripped off the table
   * @param {HTMLTableElement} options.source - source table that will be an input for data stripping
   * @param {String=} options.direction='row' - direction in which data stripping will occur: `row` strips across rows and presents an array where each array item is an array of cell values. `column` strips values verticaly in a column, the resulting array will contain arrays (per column) with values resembling normalized data for cells in the column
   * @param {Boolean=} [options.excludeBlock=true] - if table contains block cells that rowspan across several rows, we might need to exclude those from actual data
   * @param {Array|Number} [options.excludeColumns] - if table contains columns that are not to be in data, then pass a single index or an array of cell indices (0-based). You need to count columns not by headers but by the cells in rows.
   * @param {Array|Number} [options.excludeRows] - if table contains rows that are not to be in data, then pass a single index or an array of row indices (0-based). You need to count only rows that contain data, not the table-header rows.
   * @param {Boolean=} options.multidimensional=false - whether the table has aggregating cells that aggregate rowheaders. Result of {@link TableData#detectMultidimensional} may be passed here to automatically calculate if it has aggregating cells.
   * @returns {Array} returns data array.
   * */
  static getData(options){
    let {source,excludeBlock=true,excludeColumns,excludeRows,direction='row',multidimensional=false}=options;
    let data = [];
    if(source && source.tagName == 'TABLE'){
      let rows = [].slice.call(source.parentNode.querySelectorAll(`table#${source.id}>tbody>tr`));
      if(rows.length>0){
        let tempArray=[];
        // account for a negative row number (`-1`) meaning last row
        if(typeof excludeRows != undefined){
          if(typeof excludeRows == 'number'){
            // for non-block rows in multidimensional
            if(excludeRows<0){ // account for a negative column number (e.g.`-1`) meaning last column
              excludeRows= rows.length+excludeRows;
            }
            rows.splice(excludeRows,1);
          }
          if(Array.isArray(excludeRows)){
            excludeRows.sort((a,b)=>{return a>b?1:-1}).reverse(); //sort to splice from the end of the array
            excludeRows.forEach(i=>{
              if(i>=0){
                rows.splice(i,1);
              } else {
                rows.splice(rows.length+i,1);
              }
            });

          }
        }
        rows.forEach((row,rowIndex)=>{
          if(multidimensional){
            // we need to check if the `tempArray` is not empty and push it to the `data` array, because we've encountered a new block, so the old block has to be pushed to data. Then we need to create a new block array and push there
            if(row.classList.contains('firstInBlock')){
              if(Array.isArray(tempArray) && tempArray.length>0){data.push(tempArray);}
              tempArray = [];
            }
          }

          if (direction=='row' && !Array.isArray(tempArray[tempArray.length])) { // if a row in an array doesn't exist create it
            tempArray[tempArray.length] = [];
          }

          // calculate which cells to exclude
          let cells = [].slice.call(row.children);
          let temp_excludeColumns = excludeColumns;
          if(typeof temp_excludeColumns != undefined){
            if(typeof temp_excludeColumns == 'number'){
              // for non-block rows in multidimensional
              if(multidimensional && !row.classList.contains('firstInBlock') && !temp_excludeColumns<0){
                temp_excludeColumns=temp_excludeColumns+1;
              }
              if(temp_excludeColumns<0){ // account for a negative column number (e.g.`-1`) meaning last column
                temp_excludeColumns= cells.length+temp_excludeColumns;
              }
              cells.splice(temp_excludeColumns,1);
            }
            if(Array.isArray(temp_excludeColumns)){
              temp_excludeColumns.sort((a,b)=>{return a>b?1:-1}).reverse();
              temp_excludeColumns.forEach(i=>{
                if(i>=0){
                  cells.splice(multidimensional && !row.classList.contains('firstInBlock')?i+1:i,1);
                } else {
                  cells.splice(cells.length+i,1);
                }
              });
            }
          }

          cells.forEach((cell, index) => {

            // we want to run this every row because number of cells in each row may differ and we want to exclude the last one
            if (typeof direction == 'string' && direction == 'row') { //if we strip data horizontally by row
              if(!(multidimensional && excludeBlock && cell.rowSpan>1)){ // if it's a block cell we'd exclude it from data
                tempArray[tempArray.length-1].push(this.prepareDataCell(cell,rowIndex,index));
              }
            } else if (typeof direction == 'string' && direction == 'column') { //if we strip data vertically by column
              let realIndex = index;
              if(!(multidimensional && excludeBlock && cell.rowSpan>1)){ //exclude block cell
                realIndex += !row.classList.contains('firstInBlock')? 0 : -1; // offset cell that follows block cell one position back
                if (!Array.isArray(tempArray[realIndex])) { //create column array for current column if not available
                  tempArray[realIndex] = [];
                }
                tempArray[realIndex].push(this.prepareDataCell(cell,rowIndex,realIndex));
              }
            } else {
              throw new TypeError('direction has tobe a String==`row | column`, not a ${direction}')
            }
          });
        });
        //we need to push the last block Array because there'll be no `.firstInBlock` anymore to do that
        if(multidimensional && Array.isArray(tempArray) && tempArray.length>0){
          data.push(tempArray)
        } else {
          data = tempArray;
        }
      } else {
        throw new Error(`table#${source.id}'s body must contain rows`);
      }
    } else {
      throw new TypeError('source must be defined and be a table');
    }
    return data;
  }

}

export default TableData

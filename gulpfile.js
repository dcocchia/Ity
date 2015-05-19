var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var buffer = require('vinyl-buffer');
var sourcemaps = require('gulp-sourcemaps');
 
gulp.task('compress', function() {
  return gulp.src('ity.js')
    .pipe(sourcemaps.init())
    .pipe(uglify())
    .pipe(rename('ity.min.js'))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest('./dist'));
});
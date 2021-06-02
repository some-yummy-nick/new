import gulp from 'gulp';
import del from 'del'
import pug from 'gulp-pug'
import sourcemaps from 'gulp-sourcemaps'
import through2 from 'through2';
import {htmlValidator} from 'gulp-w3c-html-validator';
import browserSync from 'browser-sync'
import plumber from 'gulp-plumber'
import sass from 'gulp-sass'
import autoprefixer from 'gulp-autoprefixer'
import cleanCss from 'gulp-clean-css'
import babel from 'gulp-babel'
import uglify from 'gulp-uglify'
import imagemin from 'gulp-imagemin'
import svgSprite from 'gulp-svg-sprite'
import svgmin from 'gulp-svgmin'
import cheerio from 'gulp-cheerio'
import replace from 'gulp-replace'
import gulpIf from 'gulp-if'
import yargs from 'yargs';

const {watch, src, dest, series, parallel} = gulp;
const browserSyncCreate = browserSync.create();
const argv = yargs.argv;

const dir = {
    src: 'src',
    build: 'build'
}

const paths = {
    html: {
        src: `${dir.src}/pug/pages/*.pug`,
        all: `${dir.src}/pug/**/*.pug`,
        build: dir.build
    },
    css: {
        src: `${dir.src}/styles/style.scss`,
        all: `${dir.src}/styles/**/*.scss`,
        build: `${dir.build}/css`
    },
    js: {
        src: `${dir.src}/js/main.js`,
        all: `${dir.src}/js/**/*.js`,
        build: `${dir.build}/js`
    },
    images: {
        all: [`${dir.src}/images/**/*.{jpg,gif,png,svg}`, `!${dir.src}/images/sprite/*.*`],
        sprite: `${dir.src}/images/sprite/*.svg`,
        build: `${dir.build}/images`
    },
    fonts: {
        src: `${dir.src}/fonts/**/*.*`,
        build: `${dir.build}/fonts`
    }
}

const handleFile = (file, encoding, callback) => {
    callback(null, file);
    if (!file.w3cjs.success)
        throw Error('HTML validation error(s) found');
};

function html() {
    return src(paths.html.src)
        .pipe(plumber())
        .pipe(pug({
            pretty: true
        }))
        .pipe(gulpIf(argv.prod, htmlValidator.analyzer()))
        .pipe(gulpIf(argv.prod, through2.obj(handleFile)))
        .pipe(plumber.stop())
        .pipe(dest(paths.html.build));
}

function styles() {
    return src(paths.css.src)
        .pipe(plumber())
        .pipe(gulpIf(!argv.prod, sourcemaps.init()))
        .pipe(sass())
        .pipe(autoprefixer())
        .pipe(gulpIf(argv.prod, cleanCss({
            level: 2
        })))
        .pipe(gulpIf(!argv.prod, sourcemaps.write()))
        .pipe(plumber.stop())
        .pipe(dest(paths.css.build));
}

function scripts() {
    return src(paths.js.src)
        .pipe(plumber())
        .pipe(babel({
            presets: ['@babel/env']
        }))
        .pipe(gulpIf(argv.prod, uglify()))
        .pipe(plumber.stop())
        .pipe(dest(paths.js.build));
}

function images() {
    return src(paths.images.all)
        .pipe(imagemin([
            imagemin.gifsicle({interlaced: true}),
            imagemin.mozjpeg({quality: 85, progressive: true}),
            imagemin.optipng({optimizationLevel: 5}),
            imagemin.svgo({
                plugins: [
                    {cleanupIDs: false}
                ]
            })
        ]))
        .pipe(dest(paths.images.build));
}

function sprite() {
    return src(paths.images.sprite)
        // minify svg
        .pipe(svgmin({
            js2svg: {
                pretty: true
            }
        }))
        // remove all fill, style and stroke declarations in out shapes
        .pipe(cheerio({
            run: function ($) {
                $('[fill]').removeAttr('fill');
                $('[stroke]').removeAttr('stroke');
                $('[style]').removeAttr('style');
            },
            parserOptions: {xmlMode: true}
        }))
        // cheerio plugin create unnecessary string '&gt;', so replace it.
        .pipe(replace('&gt;', '>'))
        // build svg sprite
        .pipe(svgSprite({
            mode: {
                symbol: {
                    sprite: "sprite.svg"
                }
            }
        }))
        .pipe(dest(`${paths.images.build}/sprite`));
}

function fonts() {
    return src(paths.fonts.src)
        .pipe(dest(paths.fonts.build))
}

function clean() {
    return del([dir.build])
}

function server() {
    browserSyncCreate.init({
        server: {
            baseDir: dir.build,
        },
        open: false
    });

    watch(paths.html.all, html);
    watch(paths.css.all, styles);
    watch(paths.js.all, scripts);
    watch(paths.images.sprite, sprite);
    watch(paths.images.all, images);
    watch(`${dir.build}/**/*.*`).on('change', browserSyncCreate.reload);
}

export default series(parallel(html, styles, scripts, images, sprite, fonts), server);
export const build = series(clean, parallel(html, styles, scripts, images, sprite, fonts));